import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageDirection, MessageStatus, MessageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { Window24hService } from '../common/window-24h.service';
import { AiService } from '../ai/ai.service';
import { SettingsService } from '../settings/settings.service';
import { ChatGateway } from './chat.gateway';
import { LeadAssignmentService } from '../lead-assignment/lead-assignment.service';
import { StorageService } from '../common/storage.service';
import { normalizePhone } from '../common/phone.util';
import { ensureWhatsAppCompatibleVideo, withMp4Extension } from '../common/video-transcode.util';
import { ConversationsQueryService } from './conversations-query.service';

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
  replyTo?: {
    id: string;
    text: string;
    fromUser: boolean;
    type?: string;
    mediaUrl?: string | null;
  } | null;
  /** true si el mensaje es una respuesta/cita a otro, aunque no podamos resolver su contenido (ej. citó un mensaje que no pasó por nuestro sistema). */
  isReply?: boolean;
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

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly window24h: Window24hService,
    private readonly ai: AiService,
    private readonly settings: SettingsService,
    private readonly chatGateway: ChatGateway,
    private readonly config: ConfigService,
    private readonly leadAssignment: LeadAssignmentService,
    private readonly storage: StorageService,
    private readonly conversationsQuery: ConversationsQueryService,
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
    replyToWamid?: string;
  }): Promise<void> {
    const phone = normalizePhone(payload.from);

    // Obtener campaña activa antes de crear/actualizar todo
    const activeCampaign = await this.prisma.campaign.findFirst({
      where: { organizationId: payload.organizationId, isActive: true },
    });
    const activeCampaignId = activeCampaign?.id ?? null;

    const contactUpdateData: any = {};
    if (activeCampaignId) {
      contactUpdateData.campaignId = activeCampaignId;
    }

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
        campaignId: activeCampaignId,
      },
      update: contactUpdateData,
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
          campaignId: activeCampaignId,
        },
      });
    } else {
      const updateData: any = { lastUserMessageAt: new Date(payload.timestamp) };
      if (activeCampaignId && conversation.campaignId !== activeCampaignId) {
        updateData.campaignId = activeCampaignId;
      }
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: updateData,
      });
    }

    // Historial en CampaignContact
    if (activeCampaign) {
      await this.prisma.campaignContact.upsert({
        where: {
          campaignId_contactId: {
            campaignId: activeCampaign.id,
            contactId: contact.id,
          },
        },
        create: {
          campaignId: activeCampaign.id,
          contactId: contact.id,
        },
        update: {},
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
      let replyToId: string | undefined;
      let replyToSnapshot: Message['replyTo'];
      if (payload.replyToWamid) {
        const quoted = await this.prisma.message.findUnique({
          where: { whatsappMessageId: payload.replyToWamid },
        });
        this.logger.log(
          `registerIncomingMessage: replyToWamid=${payload.replyToWamid} quotedFound=${!!quoted}`,
        );
        if (quoted) {
          replyToId = quoted.id;
          replyToSnapshot = {
            id: quoted.id,
            text: quoted.body,
            fromUser: quoted.direction === MessageDirection.IN,
            type: quoted.type,
            mediaUrl: quoted.mediaUrl,
          };
        }
      }

      const created = await this.prisma.message.create({
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
          replyToId,
          replyToWamid: payload.replyToWamid,
        },
      });

      if (isNewConversation) {
        await this.leadAssignment.tryAutoAssignNewLead(conversation.id, payload.organizationId);
      }

      this.chatGateway.emitNewMessage(
        payload.organizationId,
        conversation.id,
        {
          id: created.id,
          conversationId: conversation.id,
          fromUser: true,
          text: payload.text,
          timestamp: payload.timestamp,
          mediaUrl: payload.mediaUrl,
          mimeType: payload.mimeType,
          fileName: payload.fileName,
          type: payload.type || MessageType.TEXT,
          replyTo: replyToSnapshot,
          isReply: !!payload.replyToWamid,
        } as any,
      );
    }
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
    return this.conversationsQuery.getConversations(organizationId, userId, userRole);
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
    return list.map((c) => ({
      ...c,
      canSend: this.window24h.canSendFreeMessage(c.lastUserMessageAt),
      windowSecondsRemaining: this.window24h.getSecondsRemaining(c.lastUserMessageAt),
    }));
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
      include: { replyTo: true },
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
      replyTo: m.replyTo
        ? {
            id: m.replyTo.id,
            text: m.replyTo.body,
            fromUser: m.replyTo.direction === MessageDirection.IN,
            type: m.replyTo.type,
            mediaUrl: m.replyTo.mediaUrl,
          }
        : undefined,
      isReply: !!(m.replyToId || m.replyToWamid),
    }));

    return { messages, nextCursor };
  }

  async getGallery(
    conversationId: string,
    organizationId: string,
    userId?: string,
    userRole?: string,
    cursor?: string,
  ): Promise<{ items: Message[]; nextCursor: string | null }> {
    await this.assertConversationAccess(conversationId, organizationId, userId, userRole);
    const take = 30;
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        OR: [
          { type: { in: [MessageType.IMAGE, MessageType.VIDEO, MessageType.AUDIO, MessageType.DOCUMENT] } },
          { body: { contains: 'http://', mode: 'insensitive' } },
          { body: { contains: 'https://', mode: 'insensitive' } }
        ]
      },
      take: take + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { whatsappTimestamp: 'desc' },
    });

    let nextCursor: string | null = null;
    if (rows.length > take) {
      nextCursor = rows.pop()!.id;
    }

    return {
      items: rows.map((m) => ({
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
      })),
      nextCursor,
    };
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
    return this.conversationsQuery.getConversation(conversationId, organizationId, userId, userRole);
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

  private async assertCanSendAndGetConversation(organizationId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, contact: { organizationId } },
      include: { contact: true },
    });
    if (!conv) throw new BadRequestException('Conversación no encontrada');
    const isSandbox = this.config.get<string>('WHATSAPP_SANDBOX', 'true') === 'true';
    if (isSandbox && !conv.contact.isSandboxAuthorized) {
      throw new ForbiddenException(
        'Este número no está autorizado en Meta (sandbox). Agrégalo en Contactos y márcalo como autorizado.',
      );
    }
    await this.settings.checkDailyLimitOrThrow(conversationId, organizationId);
    return conv;
  }

  private async ensureCampaignAssignment(
    organizationId: string,
    contactId: string,
    conversationId: string,
  ): Promise<void> {
    const activeCampaign = await this.prisma.campaign.findFirst({
      where: { organizationId, isActive: true },
    });
    if (!activeCampaign) return;

    await this.prisma.contact.update({
      where: { id: contactId },
      data: { campaignId: activeCampaign.id },
    });

    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { campaignId: true },
    });
    if (conv && conv.campaignId !== activeCampaign.id) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { campaignId: activeCampaign.id },
      });
    }

    await this.prisma.campaignContact.upsert({
      where: {
        campaignId_contactId: {
          campaignId: activeCampaign.id,
          contactId,
        },
      },
      create: {
        campaignId: activeCampaign.id,
        contactId,
      },
      update: {},
    });
  }

  async sendMessage(params: {
    organizationId: string;
    conversationId: string;
    text: string;
    fromAi?: boolean;
    sentByUserId?: string | null;
    replyToId?: string;
  }): Promise<Message> {
    const conv = await this.assertCanSendAndGetConversation(params.organizationId, params.conversationId);
    const lastUserMessageAt = conv.lastUserMessageAt ? new Date(conv.lastUserMessageAt) : null;

    let replyToSnapshot: Message['replyTo'];
    let replyToWamid: string | undefined;
    if (params.replyToId) {
      const quoted = await this.prisma.message.findFirst({
        where: { id: params.replyToId, conversationId: params.conversationId },
      });
      if (quoted) {
        replyToWamid = quoted.whatsappMessageId;
        replyToSnapshot = {
          id: quoted.id,
          text: quoted.body,
          fromUser: quoted.direction === MessageDirection.IN,
          type: quoted.type,
          mediaUrl: quoted.mediaUrl,
        };
      }
    }

    const { messageId } = await this.whatsapp.sendTextMessage(params.organizationId, {
      to: conv.contact.phone,
      text: params.text,
      lastUserMessageAt,
      replyToWamid,
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
        replyToId: replyToSnapshot?.id,
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
      replyTo: replyToSnapshot,
      isReply: !!replyToSnapshot,
    };
    this.chatGateway.emitNewMessage(params.organizationId, params.conversationId, msg);
    await this.ensureCampaignAssignment(params.organizationId, conv.contact.id, params.conversationId);
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
    const conv = await this.assertCanSendAndGetConversation(params.organizationId, params.conversationId);
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
    await this.ensureCampaignAssignment(params.organizationId, conv.contact.id, params.conversationId);
    return msg;
  }

  async sendMediaMessage(params: {
    organizationId: string;
    conversationId: string;
    file: any;
    type: MessageType;
    sentByUserId?: string | null;
  }): Promise<Message> {
    const conv = await this.assertCanSendAndGetConversation(params.organizationId, params.conversationId);

    const { buffer, mimetype, transcoded } = await ensureWhatsAppCompatibleVideo(
      params.file.buffer,
      params.file.mimetype,
    );
    const fileName = transcoded ? withMp4Extension(params.file.originalname) : params.file.originalname;

    const timestamp = Date.now();
    const path = `chats/${params.organizationId}/sent_${timestamp}_${fileName}`;
    const mediaUrl = await this.storage.uploadFile('chat-media', path, buffer, mimetype);
    if (!mediaUrl) {
      throw new BadRequestException('No se pudo subir el archivo multimedia');
    }

    const lastUserMessageAt = conv.lastUserMessageAt ? new Date(conv.lastUserMessageAt) : null;

    const { messageId } = await this.whatsapp.sendMediaMessage(params.organizationId, {
      to: conv.contact.phone,
      mediaUrl,
      type: params.type as any,
      fileName,
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
        mimeType: mimetype,
        fileName,
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
    await this.ensureCampaignAssignment(params.organizationId, conv.contact.id, params.conversationId);
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
