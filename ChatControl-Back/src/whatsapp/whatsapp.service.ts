import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Window24hService } from '../common/window-24h.service';

/** Formato esperado: número sin +, ej: 5491112345678 */
export interface SendTextMessageDto {
  to: string;
  text: string;
  lastUserMessageAt: Date | number | null;
}

/**
 * Servicio para enviar mensajes vía WhatsApp Cloud API (oficial).
 * NO usa librerías no oficiales; solo HTTP a graph.facebook.com
 */
/** Plantilla devuelta por la API de Meta (mapeada a formato compatible con la BD) */
export interface MetaTemplateDto {
  id: string;
  name: string;
  body: string;
  variables: string[];
  language: string;
  category?: string;
  status?: string;
}

@Injectable()
export class WhatsAppService {
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly businessAccountId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly window24h: Window24hService,
  ) {
    this.accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN', '');
    this.phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID', '');
    this.businessAccountId = this.config.get<string>('WHATSAPP_BUSINESS_ACCOUNT_ID', '');
  }

  /**
   * Envía un mensaje de texto. Valida ventana de 24h antes de enviar.
   * Si la ventana está cerrada, lanza BadRequestException.
   */
  async sendTextMessage(dto: SendTextMessageDto): Promise<{ messageId: string }> {
    if (!this.window24h.canSendFreeMessage(dto.lastUserMessageAt)) {
      throw new BadRequestException(
        'Ventana de 24 horas cerrada. No se puede enviar mensaje libre. El usuario debe escribir primero.',
      );
    }
    return this.sendTextMessageRaw(dto.to, dto.text);
  }

  /**
   * Envía texto sin validar ventana de 24h. Usar solo para plantillas aprobadas por WhatsApp.
   * TODO: Reemplazar por envío real de plantilla vía API de WhatsApp cuando esté configurado.
   */
  async sendTextMessageRaw(to: string, text: string): Promise<{ messageId: string }> {
    const normalized = to.replace(/\D/g, '');
    if (!normalized) throw new BadRequestException('Número de destino inválido');
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalized,
      type: 'text',
      text: { body: text },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { error?: { message: string }; messages?: Array<{ id: string }> };
    if (data.error) {
      const msg = data.error.message || 'Error al enviar mensaje por WhatsApp';
      // En desarrollo, (#10) = sin permiso: el número destino debe estar como "número de prueba" en Meta
      const hint = /permission|#10/i.test(msg)
        ? ' En modo desarrollo, añade el número de destino como número de prueba en Meta for Developers (WhatsApp > Configuración).'
        : '';
      throw new BadRequestException(msg + hint);
    }
    const messageId = data.messages?.[0]?.id;
    if (!messageId) throw new BadRequestException('WhatsApp no devolvió ID de mensaje');
    return { messageId };
  }

  /**
   * Lista plantillas aprobadas de la cuenta de WhatsApp Business (Meta).
   * Requiere WHATSAPP_BUSINESS_ACCOUNT_ID y permiso whatsapp_business_management.
   */
  async getMessageTemplates(): Promise<MetaTemplateDto[]> {
    if (!this.businessAccountId || !this.accessToken) {
      return [];
    }
    const url = `${this.baseUrl}/${this.businessAccountId}/message_templates?status=APPROVED`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    const data = (await res.json()) as {
      error?: { message: string };
      data?: Array<{
        id?: string;
        name: string;
        language: string;
        status?: string;
        category?: string;
        components?: Array<{
          type: string;
          text?: string;
          example?: { body_text?: string[][]; header_text?: string[] };
        }>;
      }>;
      paging?: { next?: string };
    };
    if (data.error) return [];
    const list = data.data ?? [];
    const out: MetaTemplateDto[] = [];
    for (const t of list) {
      const bodyComp = t.components?.find((c) => c.type === 'BODY');
      const body = bodyComp?.text ?? '';
      const variables: string[] = [];
      const matches = body.matchAll(/\{\{(\d+)\}\}/g);
      for (const m of matches) {
        const num = m[1];
        if (!variables.includes(num)) variables.push(num);
      }
      out.push({
        id: `meta_${t.name}_${t.language}`,
        name: `${t.name} (${t.language})`,
        body,
        variables,
        language: t.language,
        category: t.category,
        status: t.status,
      });
    }
    return out;
  }

  /**
   * Envía un mensaje usando una plantilla aprobada de Meta (template message API).
   * bodyParams: valores en orden para {{1}}, {{2}}, etc.
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    language: string,
    bodyParams: string[],
  ): Promise<{ messageId: string }> {
    const normalized = to.replace(/\D/g, '');
    if (!normalized) throw new BadRequestException('Número de destino inválido');
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const bodyParamsFormatted = bodyParams.map((text) => ({ type: 'text' as const, text }));
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalized,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: bodyParamsFormatted.length
          ? [{ type: 'body' as const, parameters: bodyParamsFormatted }]
          : [],
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { error?: { message: string }; messages?: Array<{ id: string }> };
    if (data.error) {
      throw new BadRequestException(data.error.message || 'Error al enviar plantilla por WhatsApp');
    }
    const messageId = data.messages?.[0]?.id;
    if (!messageId) throw new BadRequestException('WhatsApp no devolvió ID de mensaje');
    return { messageId };
  }

  /** Verificación del webhook (GET) - Meta envía hub.mode, hub.verify_token, hub.challenge */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const expectedToken = this.config.get<string>('WHATSAPP_VERIFY_TOKEN', '');
    if (mode === 'subscribe' && token === expectedToken) return challenge;
    return null;
  }
}
