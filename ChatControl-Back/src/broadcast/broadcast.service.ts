import { Injectable, BadRequestException } from '@nestjs/common';
import { MessageDirection, MessageStatus, MessageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { AiService } from '../ai/ai.service';
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
}

/** Plantilla mock. TODO: Consumir desde API de WhatsApp cuando esté configurado. */
export interface BroadcastTemplate {
  id: string;
  name: string;
  body: string;
  variables: string[]; // Nombres de variables, ej: ['nombre', 'fecha']
}

@Injectable()
export class BroadcastService {
  /** Plantillas mock. TODO: Reemplazar por BD o API de WhatsApp. */
  private readonly mockTemplates: BroadcastTemplate[] = [
    { id: 'welcome', name: 'Bienvenida', body: 'Hola {{nombre}}, gracias por contactarnos. Estamos aquí para ayudarte.', variables: ['nombre'] },
    { id: 'reminder', name: 'Recordatorio', body: 'Hola, te recordamos que tienes una cita el {{fecha}}. ¿Necesitas reprogramar?', variables: ['fecha'] },
    { id: 'promo', name: 'Promoción', body: '¡Oferta especial! {{mensaje}} Válido hasta {{fecha}}.', variables: ['mensaje', 'fecha'] },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly whatsapp: WhatsAppService,
    private readonly ai: AiService,
    private readonly gateway: ChatGateway,
  ) {}

  /** Lista contactos permitidos para broadcast (han escrito antes) con estado 24h */
  async getContacts(): Promise<BroadcastContact[]> {
    const list = await this.chat.getConversationsWithWindowStatus();
    return list.map((c) => ({
      id: c.id,
      phone: c.phone,
      canSend: c.canSend,
      windowSecondsRemaining: c.windowSecondsRemaining,
      lastMessagePreview: c.lastMessagePreview,
      lastMessageAt: c.lastMessageAt,
    }));
  }

  /** Lista plantillas (mock). TODO: Desde API WhatsApp. */
  getTemplates(): BroadcastTemplate[] {
    return [...this.mockTemplates];
  }

  /** Genera mensaje con IA a partir de instrucción. No envía; el usuario debe confirmar. */
  async generateMessage(instruction: string): Promise<string> {
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

    const messageToSend = type === 'template' && params.templateId
      ? this.resolveTemplateBody(params.templateId, params.templateVariables)
      : text.trim();

    if (!messageToSend) {
      throw new BadRequestException('El mensaje resultante está vacío');
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

    for (let i = 0; i < validIds.length; i++) {
      const conversationId = validIds[i];
      const contact = contactMap.get(conversationId)!;

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
          await this.sendTemplateToConversation(conversationId, messageToSend);
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

  private resolveTemplateBody(templateId: string, variables?: Record<string, string>): string {
    const t = this.mockTemplates.find((x) => x.id === templateId);
    if (!t) return '';
    let body = t.body;
    (t.variables || []).forEach((key) => {
      const value = variables?.[key] ?? `{{${key}}}`;
      body = body.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
    });
    return body;
  }

  private async sendTemplateToConversation(conversationId: string, text: string): Promise<void> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    });
    if (!conv) throw new BadRequestException('Conversación no encontrada');
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
