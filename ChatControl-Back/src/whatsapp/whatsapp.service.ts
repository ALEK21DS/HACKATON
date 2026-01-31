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
@Injectable()
export class WhatsAppService {
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly window24h: Window24hService,
  ) {
    this.accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN', '');
    this.phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID', '');
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

  /** Verificación del webhook (GET) - Meta envía hub.mode, hub.verify_token, hub.challenge */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const expectedToken = this.config.get<string>('WHATSAPP_VERIFY_TOKEN', '');
    if (mode === 'subscribe' && token === expectedToken) return challenge;
    return null;
  }
}
