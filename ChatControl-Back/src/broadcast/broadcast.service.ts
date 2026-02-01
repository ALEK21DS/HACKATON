import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageDirection, MessageStatus, MessageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { AiService, type AiGenerateResult } from '../ai/ai.service';
import { SettingsService } from '../settings/settings.service';
import { TemplatesService } from '../templates/templates.service';
import { ChatGateway } from '../chat/chat.gateway';

export type BroadcastMessageType = 'manual' | 'template' | 'ia';

export interface BroadcastContact {
  id: string;
  phone: string;
  name?: string;
  canSend: boolean;
  windowSecondsRemaining: number;
  lastMessagePreview: string;
  lastMessageAt: number;
  /** Solo pruebas: número autorizado en Meta (sandbox). TODO: eliminar en producción. */
  isSandboxAuthorized: boolean;
}

/** Plantilla para mensajes masivos (desde BD). */
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

  /** Lista contactos para broadcast: todos los contactos con estado 24h. Crea conversación si no existe. */
  async getContacts(): Promise<BroadcastContact[]> {
    const allContacts = await this.prisma.contact.findMany({ orderBy: { createdAt: 'desc' } });
    for (const contact of allContacts) {
      const existing = await this.prisma.conversation.findFirst({
        where: { contactId: contact.id },
      });
      if (!existing) {
        await this.prisma.conversation.create({
          data: { contactId: contact.id },
        });
      }
    }
    const list = await this.chat.getConversationsWithWindowStatus();
    return list.map((c) => ({
      id: c.id,
      phone: c.phone,
      name: c.name,
      canSend: c.canSend,
      windowSecondsRemaining: c.windowSecondsRemaining,
      lastMessagePreview: c.lastMessagePreview,
      lastMessageAt: c.lastMessageAt,
      isSandboxAuthorized: c.isSandboxAuthorized ?? false,
    }));
  }

  /** Lista plantillas: primero desde Meta (cuenta WhatsApp Business); si no hay, desde BD. */
  async getTemplates(): Promise<BroadcastTemplate[]> {
    const meta = await this.whatsapp.getMessageTemplates();
    if (meta.length > 0) {
      return meta.map((t) => ({ id: t.id, name: t.name, body: t.body, variables: t.variables }));
    }
    const list = await this.templates.findAll();
    return list.map((t) => ({ id: t.id, name: t.name, body: t.body, variables: t.variables }));
  }

  /** Genera mensaje con IA a partir de instrucción. No envía; el usuario debe confirmar. */
  async generateMessage(instruction: string): Promise<AiGenerateResult> {
    if (!instruction?.trim()) {
      throw new BadRequestException('La instrucción no puede estar vacía');
    }
    return this.ai.generateFromInstruction(instruction.trim());
  }

  /**
   * Envía mensaje masivo. Valida 24h según tipo:
   * - manual / ia: solo a contactos dentro de 24h
   * - template: a todos (dentro o fuera de 24h)
   */
  async sendBroadcast(params: {
    conversationIds: string[];
    type: BroadcastMessageType;
    text: string;
    templateId?: string;
    templateVariables?: Record<string, string>;
  }): Promise<{ sent: number; failed: number; errors: Array<{ conversationId: string; error: string }> }> {
    const { conversationIds, type, text } = params;
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
        const metaList = await this.whatsapp.getMessageTemplates();
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
        messageToSend = await this.resolveTemplateBody(params.templateId, params.templateVariables);
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

    const contacts = await this.getContacts();
    const idSet = new Set(contacts.map((c) => c.id));
    const validIds = conversationIds.filter((id) => idSet.has(id));
    if (validIds.length === 0) {
      throw new BadRequestException('Ningún contacto válido seleccionado');
    }

    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    this.gateway.emitBroadcastStarted(validIds.length);

    let sent = 0;
    let failed = 0;
    const errors: Array<{ conversationId: string; error: string }> = [];

    const isSandbox = this.config.get<string>('WHATSAPP_SANDBOX', 'true') === 'true';

    for (let i = 0; i < validIds.length; i++) {
      const conversationId = validIds[i];
      const contact = contactMap.get(conversationId)!;

      if (isSandbox && !contact.isSandboxAuthorized) {
        await this.logBroadcast(conversationId, type, 'failed', 'Número no autorizado en Meta (sandbox)');
        this.gateway.emitBroadcastMessageFailed(conversationId, i, 'Número no autorizado en Meta (sandbox)');
        failed++;
        errors.push({ conversationId, error: 'Número no autorizado en Meta (sandbox)' });
        continue;
      }

      if (type === 'manual' || type === 'ia') {
        if (!contact.canSend) {
          await this.logBroadcast(conversationId, type, 'failed', 'Fuera de ventana de 24 horas');
          this.gateway.emitBroadcastMessageFailed(conversationId, i, 'Fuera de ventana de 24 horas');
          failed++;
          errors.push({ conversationId, error: 'Fuera de ventana de 24 horas' });
          continue;
        }
      }

      try {
        if (type === 'template') {
          if (isMetaTemplate) {
            await this.sendMetaTemplateToConversation(
              conversationId,
              metaTemplateName,
              metaTemplateLanguage,
              metaBodyParams,
              metaBodyTextForChat,
            );
          } else {
            await this.sendTemplateToConversation(conversationId, messageToSend);
          }
        } else {
          await this.chat.sendMessage({
            conversationId,
            text: messageToSend,
            fromAi: type === 'ia',
          });
        }
        await this.logBroadcast(conversationId, type, 'sent');
        this.gateway.emitBroadcastMessageSent(conversationId, i);
        sent++;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await this.logBroadcast(conversationId, type, 'failed', errorMessage);
        this.gateway.emitBroadcastMessageFailed(conversationId, i, errorMessage);
        failed++;
        errors.push({ conversationId, error: errorMessage });
      }
    }

    return { sent, failed, errors };
  }

  /** Parsea id "meta_{name}_{language}" para extraer name y language (language puede ser en_US). */
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

  private async resolveTemplateBody(templateId: string, variables?: Record<string, string>): Promise<string> {
    const t = await this.templates.findOne(templateId);
    if (!t) return '';
    let body = t.body;
    (t.variables || []).forEach((key) => {
      const value = variables?.[key] ?? `{{${key}}}`;
      body = body.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
    });
    return body;
  }

  private async sendMetaTemplateToConversation(
    conversationId: string,
    templateName: string,
    language: string,
    bodyParams: string[],
    bodyTextForChat: string,
  ): Promise<void> {
    await this.settings.checkDailyLimitOrThrow(conversationId);
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    });
    if (!conv) throw new BadRequestException('Conversación no encontrada');
    const isSandbox = this.config.get<string>('WHATSAPP_SANDBOX', 'true') === 'true';
    if (isSandbox && !conv.contact.isSandboxAuthorized) {
      throw new BadRequestException('Este número no está autorizado en Meta (sandbox). Agrégalo en Contactos y márcalo como autorizado.');
    }
    const { messageId } = await this.whatsapp.sendTemplateMessage(
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
      },
    });
    this.gateway.emitNewMessage(conversationId, {
      id: created.id,
      conversationId,
      fromUser: false,
      text: displayText,
      timestamp: now.getTime(),
    });
  }

  private async sendTemplateToConversation(conversationId: string, text: string): Promise<void> {
    await this.settings.checkDailyLimitOrThrow(conversationId);
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    });
    if (!conv) throw new BadRequestException('Conversación no encontrada');
    const isSandbox = this.config.get<string>('WHATSAPP_SANDBOX', 'true') === 'true';
    if (isSandbox && !conv.contact.isSandboxAuthorized) {
      throw new BadRequestException('Este número no está autorizado en Meta (sandbox). Agrégalo en Contactos y márcalo como autorizado.');
    }
    const { messageId } = await this.whatsapp.sendTextMessageRaw(conv.contact.phone, text);
    const now = new Date();
    await this.prisma.message.create({
      data: {
        conversationId,
        direction: MessageDirection.OUT,
        type: MessageType.TEXT,
        status: MessageStatus.SENT,
        body: text,
        whatsappMessageId: messageId,
        whatsappTimestamp: now,
        fromAi: false,
      },
    });
    this.gateway.emitNewMessage(conversationId, {
      id: messageId,
      conversationId,
      fromUser: false,
      text,
      timestamp: now.getTime(),
    });
  }

  private async logBroadcast(
    conversationId: string,
    type: BroadcastMessageType,
    status: 'sent' | 'failed',
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.broadcastLog.create({
      data: {
        conversationId,
        type,
        status,
        errorMessage: status === 'failed' ? errorMessage : null,
      },
    });
  }
}
