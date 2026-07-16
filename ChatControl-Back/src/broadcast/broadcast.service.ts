import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageDirection, MessageStatus, MessageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { AiService } from '../ai/ai.service';
import { SettingsService } from '../settings/settings.service';
import { TemplatesService } from '../templates/templates.service';
import { ChatGateway } from '../chat/chat.gateway';

export type BroadcastMessageType = 'manual' | 'template' | 'ia';

export interface BroadcastContact {
  id: string;
  contactId: string;
  phone: string;
  name?: string;
  canSend: boolean;
  windowSecondsRemaining: number;
  lastMessagePreview: string;
  lastMessageAt: number;
  isSandboxAuthorized: boolean;
}

export interface BroadcastTemplate {
  id: string;
  name: string;
  body: string;
  variables: string[];
}

@Injectable()
export class BroadcastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly whatsapp: WhatsAppService,
    private readonly ai: AiService,
    private readonly settings: SettingsService,
    private readonly templates: TemplatesService,
    private readonly gateway: ChatGateway,
    private readonly config: ConfigService,
  ) {}

  /** Crea conversaciones para contactos que aún no tienen una, en un solo batch (evita N+1). */
  private async ensureConversationsExist(organizationId: string): Promise<void> {
    const missing = await this.prisma.contact.findMany({
      where: { organizationId, conversations: { none: {} } },
      select: { id: true },
    });
    if (missing.length > 0) {
      await this.prisma.conversation.createMany({
        data: missing.map((c) => ({ contactId: c.id })),
      });
    }
  }

  private matchesQuery(c: { phone: string; name?: string }, q?: string): boolean {
    if (!q?.trim()) return true;
    const needle = q.trim().toLowerCase();
    return c.phone.includes(q.trim()) || (c.name?.toLowerCase().includes(needle) ?? false);
  }

  /** ids de Contact que pertenecen a alguna de las campañas dadas. */
  private async getCampaignContactIdSet(organizationId: string, campaignIds?: string[]): Promise<Set<string> | null> {
    if (!campaignIds?.length) return null;
    const contacts = await this.prisma.contact.findMany({
      where: { organizationId, campaignId: { in: campaignIds } },
      select: { id: true },
    });
    return new Set(contacts.map((c) => c.id));
  }

  /** Lista completa (sin paginar) de contactos de broadcast. Uso interno para envíos y validaciones. */
  async getAllContacts(organizationId: string, userId?: string, userRole?: string): Promise<BroadcastContact[]> {
    await this.ensureConversationsExist(organizationId);
    const list = await this.chat.getConversationsWithWindowStatus(organizationId, userId, userRole);
    return list.map((c) => ({
      id: c.id,
      contactId: c.contactId!,
      phone: c.phone,
      name: c.name,
      canSend: c.canSend,
      windowSecondsRemaining: c.windowSecondsRemaining,
      lastMessagePreview: c.lastMessagePreview,
      lastMessageAt: c.lastMessageAt,
      isSandboxAuthorized: c.isSandboxAuthorized ?? false,
    }));
  }

  async getContacts(
    organizationId: string,
    userId?: string,
    userRole?: string,
    filter?: { q?: string; campaignIds?: string[] },
    cursor?: string,
    limit?: number,
  ): Promise<{ contacts: BroadcastContact[]; nextCursor: string | null; total: number }> {
    const [list, campaignContactIds] = await Promise.all([
      this.getAllContacts(organizationId, userId, userRole),
      this.getCampaignContactIdSet(organizationId, filter?.campaignIds),
    ]);
    const matching = list
      .filter((c) => this.matchesQuery(c, filter?.q))
      .filter((c) => !campaignContactIds || campaignContactIds.has(c.contactId));

    const take = limit && limit > 0 ? Math.min(limit, 200) : 50;
    let startIndex = 0;
    if (cursor) {
      const idx = matching.findIndex((c) => c.id === cursor);
      startIndex = idx >= 0 ? idx + 1 : 0;
    }
    const page = matching.slice(startIndex, startIndex + take);
    const nextCursor = startIndex + take < matching.length ? page[page.length - 1]?.id ?? null : null;

    return { contacts: page, nextCursor, total: matching.length };
  }

  async getAllContactIds(
    organizationId: string,
    userId?: string,
    userRole?: string,
    filter?: { q?: string; onlyCanSend?: boolean; campaignIds?: string[] },
  ): Promise<string[]> {
    const [list, campaignContactIds] = await Promise.all([
      this.getAllContacts(organizationId, userId, userRole),
      this.getCampaignContactIdSet(organizationId, filter?.campaignIds),
    ]);
    return list
      .filter((c) => this.matchesQuery(c, filter?.q))
      .filter((c) => !filter?.onlyCanSend || c.canSend)
      .filter((c) => !campaignContactIds || campaignContactIds.has(c.contactId))
      .map((c) => c.id);
  }

  /** Para cada campaña dada, ids de conversación (broadcast) de sus contactos. */
  async getCampaignConversationMap(
    organizationId: string,
    campaignIds: string[],
    userId?: string,
    userRole?: string,
  ): Promise<Record<string, string[]>> {
    if (!campaignIds.length) return {};
    const [contacts, list] = await Promise.all([
      this.prisma.contact.findMany({
        where: { organizationId, campaignId: { in: campaignIds } },
        select: { id: true, campaignId: true },
      }),
      this.getAllContacts(organizationId, userId, userRole),
    ]);
    const contactToCampaign = new Map(contacts.map((c) => [c.id, c.campaignId!]));
    const byCampaign: Record<string, string[]> = {};
    for (const conv of list) {
      const campaignId = contactToCampaign.get(conv.contactId);
      if (!campaignId) continue;
      (byCampaign[campaignId] ??= []).push(conv.id);
    }
    return byCampaign;
  }

  async getTemplates(organizationId: string): Promise<BroadcastTemplate[]> {
    const meta = await this.whatsapp.getMessageTemplates(organizationId);
    if (meta.length > 0) {
      return meta.map((t) => ({ id: t.id, name: t.name, body: t.body, variables: t.variables }));
    }
    const list = await this.templates.findAll(organizationId);
    return list.map((t) => ({ id: t.id, name: t.name, body: t.body, variables: t.variables }));
  }

  async generateMessage(organizationId: string, instruction: string) {
    if (!instruction?.trim()) {
      throw new BadRequestException('La instrucción no puede estar vacía');
    }
    return this.ai.generateFromInstruction(organizationId, instruction.trim());
  }

  async sendBroadcast(params: {
    organizationId: string;
    userId: string | null;
    conversationIds: string[];
    type: BroadcastMessageType;
    text: string;
    templateId?: string;
    templateVariables?: Record<string, string>;
  }): Promise<{ sent: number; failed: number; errors: Array<{ conversationId: string; error: string }> }> {
    const { organizationId, userId, conversationIds, type, text } = params;
    if (!conversationIds?.length) {
      throw new BadRequestException('Selecciona al menos un contacto');
    }
    if (!text?.trim() && type !== 'template') {
      throw new BadRequestException('El mensaje no puede estar vacío');
    }

    const isMetaTemplate = type === 'template' && params.templateId?.startsWith('meta_');
    let messageToSend = '';
    let metaTemplateName = '';
    let metaTemplateLanguage = '';
    let metaBodyParams: string[] = [];
    let metaBodyTextForChat = '';
    if (type === 'template' && params.templateId) {
      if (isMetaTemplate) {
        const metaList = await this.whatsapp.getMessageTemplates(organizationId);
        const metaT = metaList.find((t) => t.id === params.templateId);
        if (!metaT) throw new BadRequestException('Plantilla de Meta no encontrada');
        const parsed = this.parseMetaTemplateId(params.templateId);
        if (!parsed) throw new BadRequestException('ID de plantilla Meta inválido');
        metaTemplateName = parsed.name;
        metaTemplateLanguage = parsed.language;
        metaBodyParams = metaT.variables.map((v) => params.templateVariables?.[v] ?? '');
        metaBodyTextForChat = metaT.body;
        metaT.variables.forEach((v, idx) => {
          metaBodyTextForChat = metaBodyTextForChat.replace(
            new RegExp(`\\{\\{${v}\\}\\}`, 'g'),
            metaBodyParams[idx] ?? '',
          );
        });
      } else {
        messageToSend = await this.resolveTemplateBody(organizationId, params.templateId, params.templateVariables);
      }
    } else if (type !== 'template') {
      messageToSend = text.trim();
    }

    if (!isMetaTemplate && type === 'template' && !messageToSend) {
      throw new BadRequestException('El mensaje resultante está vacío');
    }
    if (type !== 'template' && !messageToSend) {
      throw new BadRequestException('El mensaje no puede estar vacío');
    }

    const contacts = await this.getAllContacts(organizationId);
    const idSet = new Set(contacts.map((c) => c.id));
    const validIds = conversationIds.filter((id) => idSet.has(id));
    if (validIds.length === 0) {
      throw new BadRequestException('Ningún contacto válido seleccionado');
    }

    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    this.gateway.emitBroadcastStarted(organizationId, validIds.length);

    let sent = 0;
    let failed = 0;
    const errors: Array<{ conversationId: string; error: string }> = [];

    const isSandbox = this.config.get<string>('WHATSAPP_SANDBOX', 'true') === 'true';

    for (let i = 0; i < validIds.length; i++) {
      const conversationId = validIds[i];
      const contact = contactMap.get(conversationId)!;

      if (isSandbox && !contact.isSandboxAuthorized) {
        await this.logBroadcast(organizationId, userId, conversationId, type, 'failed', 'Número no autorizado en Meta (sandbox)');
        this.gateway.emitBroadcastMessageFailed(
          organizationId,
          conversationId,
          i,
          'Número no autorizado en Meta (sandbox)',
        );
        failed++;
        errors.push({ conversationId, error: 'Número no autorizado en Meta (sandbox)' });
        continue;
      }

      if (type === 'manual' || type === 'ia' || (type === 'template' && !isMetaTemplate)) {
        if (!contact.canSend) {
          await this.logBroadcast(organizationId, userId, conversationId, type, 'failed', 'Fuera de ventana de 24 horas');
          this.gateway.emitBroadcastMessageFailed(organizationId, conversationId, i, 'Fuera de ventana de 24 horas');
          failed++;
          errors.push({ conversationId, error: 'Fuera de ventana de 24 horas' });
          continue;
        }
      }

      try {
        if (type === 'template') {
          if (isMetaTemplate) {
            await this.sendMetaTemplateToConversation(
              organizationId,
              userId,
              conversationId,
              metaTemplateName,
              metaTemplateLanguage,
              metaBodyParams,
              metaBodyTextForChat,
            );
          } else {
            await this.sendTemplateToConversation(organizationId, userId, conversationId, messageToSend);
          }
        } else {
          await this.chat.sendMessage({
            organizationId,
            conversationId,
            text: messageToSend,
            fromAi: type === 'ia',
            sentByUserId: userId,
          });
        }
        await this.logBroadcast(organizationId, userId, conversationId, type, 'sent');
        this.gateway.emitBroadcastMessageSent(organizationId, conversationId, i);
        sent++;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await this.logBroadcast(organizationId, userId, conversationId, type, 'failed', errorMessage);
        this.gateway.emitBroadcastMessageFailed(organizationId, conversationId, i, errorMessage);
        failed++;
        errors.push({ conversationId, error: errorMessage });
      }
    }

    return { sent, failed, errors };
  }

  private parseMetaTemplateId(id: string): { name: string; language: string } | null {
    if (!id.startsWith('meta_')) return null;
    const parts = id.slice(5).split('_');
    if (parts.length < 2) return null;
    if (parts.length >= 2 && parts[parts.length - 1].length === 2 && parts[parts.length - 2].length === 2) {
      return {
        language: parts.slice(-2).join('_'),
        name: parts.slice(0, -2).join('_'),
      };
    }
    return {
      language: parts[parts.length - 1],
      name: parts.slice(0, -1).join('_'),
    };
  }

  private async resolveTemplateBody(
    organizationId: string,
    templateId: string,
    variables?: Record<string, string>,
  ): Promise<string> {
    const t = await this.templates.findOne(organizationId, templateId);
    if (!t) return '';
    let body = t.body;
    (t.variables || []).forEach((key) => {
      const value = variables?.[key] ?? `{{${key}}}`;
      body = body.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
    });
    return body;
  }

  private async sendMetaTemplateToConversation(
    organizationId: string,
    userId: string | null,
    conversationId: string,
    templateName: string,
    language: string,
    bodyParams: string[],
    bodyTextForChat: string,
  ): Promise<void> {
    await this.settings.checkDailyLimitOrThrow(conversationId, organizationId);
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, contact: { organizationId } },
      include: { contact: true },
    });
    if (!conv) throw new BadRequestException('Conversación no encontrada');
    const isSandbox = this.config.get<string>('WHATSAPP_SANDBOX', 'true') === 'true';
    if (isSandbox && !conv.contact.isSandboxAuthorized) {
      throw new BadRequestException(
        'Este número no está autorizado en Meta (sandbox). Agrégalo en Contactos y márcalo como autorizado.',
      );
    }
    const { messageId } = await this.whatsapp.sendTemplateMessage(
      organizationId,
      conv.contact.phone,
      templateName,
      language,
      bodyParams,
    );
    const now = new Date();
    const displayText = bodyTextForChat.trim() || bodyParams.join(' ');
    const created = await this.prisma.message.create({
      data: {
        conversationId,
        direction: MessageDirection.OUT,
        type: MessageType.TEXT,
        status: MessageStatus.SENT,
        body: displayText,
        whatsappMessageId: messageId,
        whatsappTimestamp: now,
        fromAi: false,
        sentByUserId: userId,
      },
    });
    this.gateway.emitNewMessage(organizationId, conversationId, {
      id: created.id,
      conversationId,
      fromUser: false,
      text: displayText,
      timestamp: now.getTime(),
      type: MessageType.TEXT,
    });
  }

  private async sendTemplateToConversation(
    organizationId: string,
    userId: string | null,
    conversationId: string,
    text: string,
  ): Promise<void> {
    await this.settings.checkDailyLimitOrThrow(conversationId, organizationId);
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, contact: { organizationId } },
      include: { contact: true },
    });
    if (!conv) throw new BadRequestException('Conversación no encontrada');
    const isSandbox = this.config.get<string>('WHATSAPP_SANDBOX', 'true') === 'true';
    if (isSandbox && !conv.contact.isSandboxAuthorized) {
      throw new BadRequestException(
        'Este número no está autorizado en Meta (sandbox). Agrégalo en Contactos y márcalo como autorizado.',
      );
    }
    const { messageId } = await this.whatsapp.sendTextMessageRaw(organizationId, conv.contact.phone, text);
    const now = new Date();
    const created = await this.prisma.message.create({
      data: {
        conversationId,
        direction: MessageDirection.OUT,
        type: MessageType.TEXT,
        status: MessageStatus.SENT,
        body: text,
        whatsappMessageId: messageId,
        whatsappTimestamp: now,
        fromAi: false,
        sentByUserId: userId,
      },
    });
    this.gateway.emitNewMessage(organizationId, conversationId, {
      id: created.id,
      conversationId,
      fromUser: false,
      text,
      timestamp: now.getTime(),
      type: MessageType.TEXT,
    });
  }

  async getAssignmentAuditLogs(organizationId: string) {
    const logs = await this.prisma.conversationAssignmentLog.findMany({
      where: {
        conversation: { contact: { organizationId } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const userIds = new Set<string>();
    for (const l of logs) {
      if (l.fromUserId) userIds.add(l.fromUserId);
      if (l.toUserId) userIds.add(l.toUserId);
      userIds.add(l.reassignedByUserId);
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, email: true, displayName: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    return logs.map((l) => ({
      ...l,
      fromUser: l.fromUserId ? userMap[l.fromUserId] ?? null : null,
      toUser: l.toUserId ? userMap[l.toUserId] ?? null : null,
      reassignedBy: userMap[l.reassignedByUserId] ?? null,
    }));
  }

  async getBroadcastAuditLogs(organizationId: string) {
    return this.prisma.broadcastLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async logBroadcast(
    organizationId: string,
    userId: string | null,
    conversationId: string,
    type: BroadcastMessageType,
    status: 'sent' | 'failed',
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.broadcastLog.create({
      data: {
        organizationId,
        userId,
        conversationId,
        type,
        status,
        errorMessage: status === 'failed' ? errorMessage : null,
      },
    });
  }
}
