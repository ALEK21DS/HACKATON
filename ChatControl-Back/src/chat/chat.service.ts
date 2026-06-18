import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageDirection, MessageStatus, MessageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { Window24hService } from '../common/window-24h.service';
import { AiService } from '../ai/ai.service';
import { SettingsService } from '../settings/settings.service';
import { ChatGateway } from './chat.gateway';
import { LeadAssignmentService } from '../lead-assignment/lead-assignment.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { StorageService } from '../common/storage.service';

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
  status?: string;
}

export interface Conversation {
  id: string;
  phone: string;
  name?: string;
  email?: string | null;
  contactId?: string;
  isSandboxAuthorized?: boolean;
  lastUserMessageAt: number | null;
  lastMessagePreview: string;
  lastMessageAt: number;
  unreadCount: number;
  assignedToUserId?: string | null;
  isNewLead?: boolean;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function normalizeMessageText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\w\s\u00C0-\u024F]/g, '')
    .trim()
    .toLowerCase();
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
    private readonly leadAssignment: LeadAssignmentService,
    private readonly integrations: IntegrationsService,
    private readonly storage: StorageService,
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
    const isNewConversation = !conversation;

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

    // Detectar edición: buscar mensaje existente por wamid
    const existingMessage = await this.prisma.message.findUnique({
      where: { whatsappMessageId: payload.messageId },
    });

    if (existingMessage) {
      const bodyChanged = existingMessage.body !== payload.text;
      if (bodyChanged) {
        await this.prisma.messageEditHistory.create({
          data: {
            messageId: existingMessage.id,
            previousBody: existingMessage.body,
          },
        });
        await this.prisma.message.update({
          where: { id: existingMessage.id },
          data: {
            body: payload.text,
            isEdited: true,
            editedAt: new Date(),
            mediaUrl: payload.mediaUrl ?? existingMessage.mediaUrl,
            mimeType: payload.mimeType ?? existingMessage.mimeType,
            fileName: payload.fileName ?? existingMessage.fileName,
          },
        });
        this.chatGateway.emitMessageEdited(
          payload.organizationId,
          conversation.id,
          existingMessage.id,
          payload.text,
        );
      }
    } else {
      await this.prisma.message.create({
        data: {
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
      });

      if (isNewConversation && payload.type === MessageType.TEXT) {
        await this.tryAutoDetectAndAssign(conversation.id, payload.organizationId, payload.text);
      }

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
          fileName: payload.fileName,
          type: payload.type || MessageType.TEXT,
        } as any,
      );
    }
  }

  private async tryAutoDetectAndAssign(
    conversationId: string,
    organizationId: string,
    messageText: string,
  ): Promise<void> {
    try {
      const config = await this.integrations.getLeadDetectionConfig(organizationId);
      if (!config.enabled || !config.autoMessage) return;

      const normalizedReceived = normalizeMessageText(messageText);
      const normalizedConfigured = normalizeMessageText(config.autoMessage);

      if (normalizedReceived.length < 10 || normalizedConfigured.length < 10) return;

      const similarity = this.computeSimilarity(normalizedReceived, normalizedConfigured);
      if (similarity < 0.75) return;

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          autoMessageDetectedAt: new Date(),
          isNewLead: true,
        },
      });

      await this.leadAssignment.assignNewLead(conversationId, organizationId);
    } catch (error) {
      // Silently fail - lead detection should never break message reception
    }
  }

  private computeSimilarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    const editDist = this.levenshteinDistance(longer, shorter);
    return 1.0 - editDist / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost,
        );
      }
    }
    return matrix[b.length][a.length];
  }

  private async assertConversationInOrg(conversationId: string, organizationId: string): Promise<void> {
    const c = await this.prisma.conversation.findFirst({
      where: { id: conversationId, contact: { organizationId } },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Conversación no encontrada');
  }

  async getConversations(
    organizationId: string,
    userId?: string,
    userRole?: string,
  ): Promise<Conversation[]> {
    const where: any = { contact: { organizationId } };

    if (userRole === 'AGENT' && userId) {
      where.assignedToUserId = userId;
    }

    const list = await this.prisma.conversation.findMany({
      where,
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
        let lastMessagePreview = lastMsg?.body.slice(0, 80) ?? '';
        if (lastMsg && !lastMessagePreview) {
          if (lastMsg.type === MessageType.IMAGE) lastMessagePreview = '📷 Imagen';
          else if (lastMsg.type === MessageType.VIDEO) lastMessagePreview = '🎥 Video';
          else if (lastMsg.type === MessageType.AUDIO) lastMessagePreview = '🎵 Audio';
          else if (lastMsg.type === MessageType.DOCUMENT) lastMessagePreview = '📄 Documento';
        }
        return {
          id: c.id,
          phone: c.contact.phone,
          name: c.contact.name ?? undefined,
          email: c.contact.email ?? undefined,
          contactId: c.contact.id,
          isSandboxAuthorized: c.contact.isSandboxAuthorized,
          lastUserMessageAt: c.lastUserMessageAt?.getTime() ?? null,
          lastMessagePreview,
          lastMessageAt: lastMsg?.whatsappTimestamp.getTime() ?? c.createdAt.getTime(),
          unreadCount,
          assignedToUserId: c.assignedToUserId,
          isNewLead: c.isNewLead,
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
    userId?: string,
    userRole?: string,
  ): Promise<Array<Conversation & { canSend: boolean; windowSecondsRemaining: number }>> {
    const list = await this.getConversations(organizationId, userId, userRole);
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
    cursor?: string,
    userId?: string,
    userRole?: string,
  ): Promise<{ messages: Message[]; nextCursor: string | null }> {
    await this.assertConversationAccess(conversationId, organizationId, userId, userRole);
    
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
      status: m.status,
    }));

    return { messages, nextCursor };
  }

  async getGallery(conversationId: string, organizationId: string, userId?: string, userRole?: string): Promise<Message[]> {
    await this.assertConversationAccess(conversationId, organizationId, userId, userRole);
    const rows = await this.prisma.message.findMany({
      where: { 
        conversationId,
        OR: [
          { type: { in: [MessageType.IMAGE, MessageType.VIDEO, MessageType.AUDIO, MessageType.DOCUMENT] } },
          { body: { contains: 'http://', mode: 'insensitive' } },
          { body: { contains: 'https://', mode: 'insensitive' } }
        ]
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
      mediaUrl: m.mediaUrl,
      mimeType: m.mimeType,
      fileName: m.fileName,
    }));
  }

  async searchMessages(conversationId: string, organizationId: string, query: string, userId?: string, userRole?: string): Promise<Message[]> {
    await this.assertConversationAccess(conversationId, organizationId, userId, userRole);
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
    userId?: string,
    userRole?: string,
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

    if (userRole === 'AGENT' && userId && c.assignedToUserId !== userId) {
      return undefined;
    }

    const lastMsg = c.messages[0];
    const unreadCount = await this.getUnreadCount(conversationId);
    let lastMessagePreview = lastMsg?.body.slice(0, 80) ?? '';
    if (lastMsg && !lastMessagePreview) {
      if (lastMsg.type === MessageType.IMAGE) lastMessagePreview = '📷 Imagen';
      else if (lastMsg.type === MessageType.VIDEO) lastMessagePreview = '🎥 Video';
      else if (lastMsg.type === MessageType.AUDIO) lastMessagePreview = '🎵 Audio';
      else if (lastMsg.type === MessageType.DOCUMENT) lastMessagePreview = '📄 Documento';
    }
    return {
      id: c.id,
      phone: c.contact.phone,
      name: c.contact.name ?? undefined,
      email: c.contact.email ?? undefined,
      contactId: c.contact.id,
      isSandboxAuthorized: c.contact.isSandboxAuthorized,
      lastUserMessageAt: c.lastUserMessageAt?.getTime() ?? null,
      lastMessagePreview,
      lastMessageAt: lastMsg?.whatsappTimestamp.getTime() ?? c.createdAt.getTime(),
      unreadCount,
      assignedToUserId: c.assignedToUserId,
      isNewLead: c.isNewLead,
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
      status: created.status,
    };
    this.chatGateway.emitNewMessage(params.organizationId, params.conversationId, msg);
    return msg;
  }

  async sendMedia(params: {
    organizationId: string;
    conversationId: string;
    mediaUrl: string;
    mimeType: string;
    fileName?: string;
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

    const msgType = params.mimeType.startsWith('image/') ? MessageType.IMAGE
      : params.mimeType.startsWith('video/') ? MessageType.VIDEO
      : params.mimeType.startsWith('audio/') ? MessageType.AUDIO
      : MessageType.DOCUMENT;

    const { messageId } = await this.whatsapp.sendMediaRaw(
      params.organizationId,
      conv.contact.phone,
      params.mediaUrl,
      params.mimeType,
      params.fileName,
    );

    const now = new Date();
    const created = await this.prisma.message.create({
      data: {
        conversationId: params.conversationId,
        direction: MessageDirection.OUT,
        type: msgType,
        status: MessageStatus.SENT,
        body: params.fileName || '',
        mediaUrl: params.mediaUrl,
        mimeType: params.mimeType,
        fileName: params.fileName || null,
        whatsappMessageId: messageId,
        whatsappTimestamp: now,
        fromAi: false,
        sentByUserId: params.sentByUserId ?? null,
      },
    });
    const msg: Message = {
      id: created.id,
      conversationId: created.conversationId,
      fromUser: false,
      text: created.body,
      timestamp: created.whatsappTimestamp.getTime(),
      type: created.type,
      mediaUrl: created.mediaUrl,
      mimeType: created.mimeType,
      fileName: created.fileName,
      status: created.status,
    };
    this.chatGateway.emitNewMessage(params.organizationId, params.conversationId, msg);
    return msg;
  }

  async sendMediaMessage(params: {
    organizationId: string;
    conversationId: string;
    file: any;
    type: MessageType;
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

    const timestamp = Date.now();
    const path = `chats/${params.organizationId}/sent_${timestamp}_${params.file.originalname}`;
    const mediaUrl = await this.storage.uploadFile(
      'chat-media',
      path,
      params.file.buffer,
      params.file.mimetype,
    );
    if (!mediaUrl) {
      throw new BadRequestException('No se pudo subir el archivo multimedia');
    }

    const lastUserMessageAt = conv.lastUserMessageAt ? new Date(conv.lastUserMessageAt) : null;

    const { messageId } = await this.whatsapp.sendMediaMessage(params.organizationId, {
      to: conv.contact.phone,
      mediaUrl,
      type: params.type as any,
      fileName: params.file.originalname,
      lastUserMessageAt,
    });

    const now = new Date();
    const created = await this.prisma.message.create({
      data: {
        conversationId: params.conversationId,
        direction: MessageDirection.OUT,
        type: params.type,
        status: MessageStatus.SENT,
        body: '',
        whatsappMessageId: messageId,
        whatsappTimestamp: now,
        fromAi: false,
        sentByUserId: params.sentByUserId ?? null,
        mediaUrl,
        mimeType: params.file.mimetype,
        fileName: params.file.originalname,
      },
    });

    const msg: Message = {
      id: created.id,
      conversationId: created.conversationId,
      fromUser: false,
      text: created.body,
      timestamp: created.whatsappTimestamp.getTime(),
      fromAi: created.fromAi ?? undefined,
      type: created.type,
      mediaUrl: created.mediaUrl,
      mimeType: created.mimeType,
      fileName: created.fileName,
    };

    this.chatGateway.emitNewMessage(params.organizationId, params.conversationId, msg);
    return msg;
  }

  async generateAiReply(
    organizationId: string,
    conversationId: string,
  ): Promise<{ text: string; usedFallbackModel?: boolean }> {
    await this.assertConversationInOrg(conversationId, organizationId);
    
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { whatsappTimestamp: 'desc' },
      take: 10,
    });
    
    const recent = rows
      .reverse()
      .map((m) => (m.direction === MessageDirection.IN ? `Cliente: ${m.body}` : `Agente: ${m.body}`));
      
    const context = recent.join('\n');
    return this.ai.generateReply(organizationId, context);
  }

  emitMessageStatusUpdate(organizationId: string, conversationId: string, messageId: string, status: string): void {
    this.chatGateway.emitMessageStatusUpdate(organizationId, conversationId, messageId, status);
  }

  async assignConversation(
    conversationId: string,
    organizationId: string,
    assignToUserId: string | null,
  ): Promise<void> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, contact: { organizationId } },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    if (assignToUserId) {
      const user = await this.prisma.user.findFirst({
        where: { id: assignToUserId, organizationId },
      });
      if (!user) throw new BadRequestException('Usuario no encontrado en esta organización');
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedToUserId: assignToUserId,
        assignedAt: assignToUserId ? new Date() : null,
      },
    });

    this.chatGateway.emitConversationAssigned(
      organizationId,
      conversationId,
      assignToUserId || '',
    );
  }

  private async assertConversationAccess(
    conversationId: string,
    organizationId: string,
    userId?: string,
    userRole?: string,
  ): Promise<void> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, contact: { organizationId } },
      select: { id: true, assignedToUserId: true },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    if (userRole === 'AGENT' && userId && conv.assignedToUserId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }
  }
}
