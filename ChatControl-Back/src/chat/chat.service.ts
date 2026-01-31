import { Injectable, BadRequestException } from '@nestjs/common';
import { MessageDirection, MessageStatus, MessageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { Window24hService } from '../common/window-24h.service';
import { AiService } from '../ai/ai.service';
import { ChatGateway } from './chat.gateway';

export interface Message {
  id: string;
  conversationId: string;
  fromUser: boolean;
  text: string;
  timestamp: number;
  fromAi?: boolean;
}

export interface Conversation {
  id: string;
  phone: string;
  lastUserMessageAt: number | null;
  lastMessagePreview: string;
  lastMessageAt: number;
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
    private readonly chatGateway: ChatGateway,
  ) {}

  /** Registra mensaje entrante desde el webhook de WhatsApp */
  async registerIncomingMessage(payload: {
    from: string;
    messageId: string;
    timestamp: number;
    text: string;
  }): Promise<void> {
    const phone = normalizePhone(payload.from);
    const contact = await this.prisma.contact.upsert({
      where: { phone },
      create: { phone },
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
        type: MessageType.TEXT,
        status: MessageStatus.RECEIVED,
        body: payload.text,
        whatsappMessageId: payload.messageId,
        whatsappTimestamp: new Date(payload.timestamp),
      },
      update: {},
    });
    // Notificar en tiempo real al frontend (elimina necesidad de polling)
    this.chatGateway.emitNewMessage(conversation.id, {
      id: payload.messageId,
      conversationId: conversation.id,
      fromUser: true,
      text: payload.text,
      timestamp: payload.timestamp,
    });
  }

  async getConversations(): Promise<Conversation[]> {
    const list = await this.prisma.conversation.findMany({
      include: {
        contact: true,
        messages: {
          orderBy: { whatsappTimestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((c) => {
      const lastMsg = c.messages[0];
      return {
        id: c.id,
        phone: c.contact.phone,
        lastUserMessageAt: c.lastUserMessageAt?.getTime() ?? null,
        lastMessagePreview: lastMsg?.body.slice(0, 80) ?? '',
        lastMessageAt: lastMsg?.whatsappTimestamp.getTime() ?? c.createdAt.getTime(),
      };
    }).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }

  /**
   * Lista conversaciones con estado de ventana 24h (para mensajes masivos).
   * Solo contactos que hayan escrito antes (tienen conversación).
   */
  async getConversationsWithWindowStatus(): Promise<
    Array<Conversation & { canSend: boolean; windowSecondsRemaining: number }>
  > {
    const list = await this.getConversations();
    const result = await Promise.all(
      list.map(async (c) => {
        const [canSend, windowSecondsRemaining] = await Promise.all([
          this.canSendToConversation(c.id),
          this.getWindowSecondsRemaining(c.id),
        ]);
        return { ...c, canSend, windowSecondsRemaining };
      }),
    );
    return result;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { whatsappTimestamp: 'asc' },
    });
    return rows.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      fromUser: m.direction === MessageDirection.IN,
      text: m.body,
      timestamp: m.whatsappTimestamp.getTime(),
      fromAi: m.fromAi ?? undefined,
    }));
  }

  async getConversation(conversationId: string): Promise<Conversation | undefined> {
    const c = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
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
    return {
      id: c.id,
      phone: c.contact.phone,
      lastUserMessageAt: c.lastUserMessageAt?.getTime() ?? null,
      lastMessagePreview: lastMsg?.body.slice(0, 80) ?? '',
      lastMessageAt: lastMsg?.whatsappTimestamp.getTime() ?? c.createdAt.getTime(),
    };
  }

  async canSendToConversation(conversationId: string): Promise<boolean> {
    const lastAt = await this.getConversationLastUserMessageAt(conversationId);
    return this.window24h.canSendFreeMessage(lastAt);
  }

  async getWindowSecondsRemaining(conversationId: string): Promise<number> {
    const lastAt = await this.getConversationLastUserMessageAt(conversationId);
    return this.window24h.getSecondsRemaining(lastAt);
  }

  private async getConversationLastUserMessageAt(
    conversationId: string,
  ): Promise<Date | null> {
    const c = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { lastUserMessageAt: true },
    });
    return c?.lastUserMessageAt ?? null;
  }

  async sendMessage(params: {
    conversationId: string;
    text: string;
    fromAi?: boolean;
  }): Promise<Message> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: params.conversationId },
      include: { contact: true },
    });
    if (!conv) throw new BadRequestException('Conversación no encontrada');
    const lastUserMessageAt = conv.lastUserMessageAt
      ? new Date(conv.lastUserMessageAt)
      : null;
    const { messageId } = await this.whatsapp.sendTextMessage({
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
    // Notificar en tiempo real al frontend
    this.chatGateway.emitNewMessage(params.conversationId, msg);
    return msg;
  }

  async generateAiReply(conversationId: string): Promise<string> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new BadRequestException('Conversación no encontrada');
    const messages = await this.getMessages(conversationId);
    const recent = messages.slice(-10).map((m) =>
      m.fromUser ? `Cliente: ${m.text}` : `Agente: ${m.text}`,
    );
    const context = recent.join('\n');
    return this.ai.generateReply(context);
  }
}
