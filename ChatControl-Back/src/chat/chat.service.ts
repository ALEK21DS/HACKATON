import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageDirection, MessageStatus, MessageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { Window24hService } from '../common/window-24h.service';
import { AiService } from '../ai/ai.service';
import { SettingsService } from '../settings/settings.service';
import { ChatGateway } from './chat.gateway';

export interface Message {
  id: string;
  conversationId: string;
  fromUser: boolean;
  text: string;
  timestamp: number;
  fromAi?: boolean;
  type?: string;
  mediaUrl?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
}

export interface Conversation {
  id: string;
  phone: string;
  name?: string;
  isSandboxAuthorized?: boolean;
  lastUserMessageAt: number | null;
  lastMessagePreview: string;
  lastMessageAt: number;
  unreadCount: number;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly window24h: Window24hService,
    private readonly ai: AiService,
    private readonly settings: SettingsService,
    private readonly chatGateway: ChatGateway,
    private readonly config: ConfigService,
  ) {}

  async registerIncomingMessage(payload: {
    organizationId: string;
    from: string;
    messageId: string;
    timestamp: number;
    text: string;
    type?: MessageType;
    mediaUrl?: string;
    mimeType?: string;
    fileName?: string;
    contactName?: string;
  }): Promise<void> {
    const phone = normalizePhone(payload.from);
    const contact = await this.prisma.contact.upsert({
      where: {
        organizationId_phone: {
          organizationId: payload.organizationId,
          phone,
        },
      },
      create: { 
        organizationId: payload.organizationId, 
        phone,
        name: payload.contactName || null,
      },
      update: {},
    });
    let conversation = await this.prisma.conversation.findFirst({
      where: { contactId: contact.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          contactId: contact.id,
          lastUserMessageAt: new Date(payload.timestamp),
        },
      });
    } else {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastUserMessageAt: new Date(payload.timestamp) },
      });
    }
    await this.prisma.message.upsert({
      where: { whatsappMessageId: payload.messageId },
      create: {
        conversationId: conversation.id,
        direction: MessageDirection.IN,
        type: payload.type || MessageType.TEXT,
        status: MessageStatus.RECEIVED,
        body: payload.text,
        mediaUrl: payload.mediaUrl,
        mimeType: payload.mimeType,
        fileName: payload.fileName,
        whatsappMessageId: payload.messageId,
        whatsappTimestamp: new Date(payload.timestamp),
      },
      update: {},
    });
    this.chatGateway.emitNewMessage(
      payload.organizationId,
      conversation.id,
      {
        id: payload.messageId,
        conversationId: conversation.id,
        fromUser: true,
        text: payload.text,
        timestamp: payload.timestamp,
        mediaUrl: payload.mediaUrl,
        mimeType: payload.mimeType,
      } as any,
    );
  }

  private async assertConversationInOrg(conversationId: string, organizationId: string): Promise<void> {
    const c = await this.prisma.conversation.findFirst({
      where: { id: conversationId, contact: { organizationId } },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Conversación no encontrada');
  }

  async getConversations(organizationId: string): Promise<Conversation[]> {
    const list = await this.prisma.conversation.findMany({
      where: { contact: { organizationId } },
      include: {
        contact: true,
        messages: {
          orderBy: { whatsappTimestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const withUnread = await Promise.all(
      list.map(async (c) => {
        const lastMsg = c.messages[0];
        const unreadCount = await this.getUnreadCount(c.id);
        return {
          id: c.id,
          phone: c.contact.phone,
          name: c.contact.name ?? undefined,
          isSandboxAuthorized: c.contact.isSandboxAuthorized,
          lastUserMessageAt: c.lastUserMessageAt?.getTime() ?? null,
          lastMessagePreview: lastMsg?.body.slice(0, 80) ?? '',
          lastMessageAt: lastMsg?.whatsappTimestamp.getTime() ?? c.createdAt.getTime(),
          unreadCount,
        };
      }),
    );
    return withUnread.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }

  private async getUnreadCount(conversationId: string): Promise<number> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { lastReadAt: true },
    });
    const since = conv?.lastReadAt ?? new Date(0);
    return this.prisma.message.count({
      where: {
        conversationId,
        direction: MessageDirection.IN,
        whatsappTimestamp: { gt: since },
      },
    });
  }

  async markConversationAsRead(conversationId: string, organizationId: string): Promise<void> {
    await this.assertConversationInOrg(conversationId, organizationId);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastReadAt: new Date() },
    });
  }

  async getConversationsWithWindowStatus(
    organizationId: string,
  ): Promise<Array<Conversation & { canSend: boolean; windowSecondsRemaining: number }>> {
    const list = await this.getConversations(organizationId);
    const result = await Promise.all(
      list.map(async (c) => {
        const [canSend, windowSecondsRemaining] = await Promise.all([
          this.canSendToConversation(c.id, organizationId),
          this.getWindowSecondsRemaining(c.id, organizationId),
        ]);
        return { ...c, canSend, windowSecondsRemaining };
      }),
    );
    return result;
  }

  async getMessages(
    conversationId: string, 
    organizationId: string, 
    cursor?: string
  ): Promise<{ messages: Message[]; nextCursor: string | null }> {
    await this.assertConversationInOrg(conversationId, organizationId);
    
    const take = 50;
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      take: take + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { whatsappTimestamp: 'desc' },
    });

    let nextCursor: string | null = null;
    if (rows.length > take) {
      const nextItem = rows.pop();
      nextCursor = nextItem!.id;
    }

    const messages = rows.reverse().map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      fromUser: m.direction === MessageDirection.IN,
      text: m.body,
      timestamp: m.whatsappTimestamp.getTime(),
      fromAi: m.fromAi ?? undefined,
      type: m.type,
      mediaUrl: m.mediaUrl,
      mimeType: m.mimeType,
      fileName: m.fileName,
    }));

    return { messages, nextCursor };
  }

  async getGallery(conversationId: string, organizationId: string): Promise<Message[]> {
    await this.assertConversationInOrg(conversationId, organizationId);
    const rows = await this.prisma.message.findMany({
      where: { 
        conversationId,
        OR: [
          { type: { in: [MessageType.IMAGE, MessageType.VIDEO, MessageType.AUDIO, MessageType.DOCUMENT] } },
          { body: { contains: 'http://', mode: 'insensitive' } },
          { body: { contains: 'https://', mode: 'insensitive' } }
        ]
      },
      orderBy: { whatsappTimestamp: 'desc' }, // Descending for gallery view
    });
    return rows.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      fromUser: m.direction === MessageDirection.IN,
      text: m.body,
      timestamp: m.whatsappTimestamp.getTime(),
      fromAi: m.fromAi ?? undefined,
      type: m.type,
      mediaUrl: m.mediaUrl,
      mimeType: m.mimeType,
      fileName: m.fileName,
    }));
  }

  async searchMessages(conversationId: string, organizationId: string, query: string): Promise<Message[]> {
    await this.assertConversationInOrg(conversationId, organizationId);
    if (!query || query.trim().length === 0) return [];
    
    const rows = await this.prisma.message.findMany({
      where: { 
        conversationId,
        body: { contains: query, mode: 'insensitive' },
        type: MessageType.TEXT
      },
      orderBy: { whatsappTimestamp: 'desc' },
    });
    return rows.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      fromUser: m.direction === MessageDirection.IN,
      text: m.body,
      timestamp: m.whatsappTimestamp.getTime(),
      fromAi: m.fromAi ?? undefined,
      type: m.type,
    }));
  }

  async getConversation(
    conversationId: string,
    organizationId: string,
  ): Promise<Conversation | undefined> {
    const c = await this.prisma.conversation.findFirst({
      where: { id: conversationId, contact: { organizationId } },
      include: {
        contact: true,
        messages: {
          orderBy: { whatsappTimestamp: 'desc' },
          take: 1,
        },
      },
    });
    if (!c) return undefined;
    const lastMsg = c.messages[0];
    const unreadCount = await this.getUnreadCount(conversationId);
    return {
      id: c.id,
      phone: c.contact.phone,
      name: c.contact.name ?? undefined,
      isSandboxAuthorized: c.contact.isSandboxAuthorized,
      lastUserMessageAt: c.lastUserMessageAt?.getTime() ?? null,
      lastMessagePreview: lastMsg?.body.slice(0, 80) ?? '',
      lastMessageAt: lastMsg?.whatsappTimestamp.getTime() ?? c.createdAt.getTime(),
      unreadCount,
    };
  }

  async canSendToConversation(conversationId: string, organizationId: string): Promise<boolean> {
    await this.assertConversationInOrg(conversationId, organizationId);
    const lastAt = await this.getConversationLastUserMessageAt(conversationId);
    return this.window24h.canSendFreeMessage(lastAt);
  }

  async getWindowSecondsRemaining(conversationId: string, organizationId: string): Promise<number> {
    await this.assertConversationInOrg(conversationId, organizationId);
    const lastAt = await this.getConversationLastUserMessageAt(conversationId);
    return this.window24h.getSecondsRemaining(lastAt);
  }

  private async getConversationLastUserMessageAt(conversationId: string): Promise<Date | null> {
    const c = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { lastUserMessageAt: true },
    });
    return c?.lastUserMessageAt ?? null;
  }

  async sendMessage(params: {
    organizationId: string;
    conversationId: string;
    text: string;
    fromAi?: boolean;
    sentByUserId?: string | null;
  }): Promise<Message> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: params.conversationId, contact: { organizationId: params.organizationId } },
      include: { contact: true },
    });
    if (!conv) throw new BadRequestException('Conversación no encontrada');
    const isSandbox = this.config.get<string>('WHATSAPP_SANDBOX', 'true') === 'true';
    if (isSandbox && !conv.contact.isSandboxAuthorized) {
      throw new ForbiddenException(
        'Este número no está autorizado en Meta (sandbox). Agrégalo en Contactos y márcalo como autorizado.',
      );
    }
    await this.settings.checkDailyLimitOrThrow(params.conversationId, params.organizationId);
    const lastUserMessageAt = conv.lastUserMessageAt ? new Date(conv.lastUserMessageAt) : null;
    const { messageId } = await this.whatsapp.sendTextMessage(params.organizationId, {
      to: conv.contact.phone,
      text: params.text,
      lastUserMessageAt,
    });
    const now = new Date();
    const created = await this.prisma.message.create({
      data: {
        conversationId: params.conversationId,
        direction: MessageDirection.OUT,
        type: MessageType.TEXT,
        status: MessageStatus.SENT,
        body: params.text,
        whatsappMessageId: messageId,
        whatsappTimestamp: now,
        fromAi: params.fromAi ?? false,
        sentByUserId: params.sentByUserId ?? null,
      },
    });
    const msg: Message = {
      id: created.id,
      conversationId: created.conversationId,
      fromUser: false,
      text: created.body,
      timestamp: created.whatsappTimestamp.getTime(),
      fromAi: created.fromAi ?? undefined,
    };
    this.chatGateway.emitNewMessage(params.organizationId, params.conversationId, msg);
    return msg;
  }

  async generateAiReply(
    organizationId: string,
    conversationId: string,
  ): Promise<{ text: string; usedFallbackModel?: boolean }> {
    await this.assertConversationInOrg(conversationId, organizationId);
    
    // Fetch last 10 messages for context
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { whatsappTimestamp: 'desc' },
      take: 10,
    });
    
    // Reverse to chronological order
    const recent = rows
      .reverse()
      .map((m) => (m.direction === MessageDirection.IN ? `Cliente: ${m.body}` : `Agente: ${m.body}`));
      
    const context = recent.join('\n');
    return this.ai.generateReply(organizationId, context);
  }
}
