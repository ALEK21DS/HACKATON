import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SecretsCryptoService } from '../common/secrets-crypto.service';
import { Window24hService } from '../common/window-24h.service';

export interface SendTextMessageDto {
  to: string;
  text: string;
  lastUserMessageAt: Date | number | null;
}

export interface MetaTemplateDto {
  id: string;
  name: string;
  body: string;
  variables: string[];
  language: string;
  category?: string;
  status?: string;
}

export interface ResolvedWhatsappCreds {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
}

@Injectable()
export class WhatsAppService {
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';

  constructor(
    private readonly config: ConfigService,
    private readonly window24h: Window24hService,
    private readonly prisma: PrismaService,
    private readonly crypto: SecretsCryptoService,
  ) {}

  async resolveCredentials(organizationId: string): Promise<ResolvedWhatsappCreds> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { credentials: true },
    });
    if (!org) throw new BadRequestException('Organización no encontrada');
    let accessToken = '';
    if (org.credentials?.whatsappAccessTokenEnc) {
      try {
        accessToken = this.crypto.decrypt(org.credentials.whatsappAccessTokenEnc);
      } catch {
        accessToken = '';
      }
    }
    if (!accessToken) {
      accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN', '') || '';
    }
    const phoneNumberId =
      org.whatsappPhoneNumberId?.trim() ||
      this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID', '') ||
      '';
    let businessAccountId = '';
    if (org.credentials?.whatsappBusinessAccountIdEnc) {
      try {
        businessAccountId = this.crypto.decrypt(org.credentials.whatsappBusinessAccountIdEnc);
      } catch {
        businessAccountId = '';
      }
    }
    if (!businessAccountId) {
      businessAccountId = this.config.get<string>('WHATSAPP_BUSINESS_ACCOUNT_ID', '') || '';
    }
    if (!accessToken || !phoneNumberId) {
      throw new BadRequestException(
        'WhatsApp no configurado: token o phone number ID (integraciones o .env).',
      );
    }
    return { accessToken, phoneNumberId, businessAccountId };
  }

  async sendTextMessage(
    organizationId: string,
    dto: SendTextMessageDto,
  ): Promise<{ messageId: string }> {
    if (!this.window24h.canSendFreeMessage(dto.lastUserMessageAt)) {
      throw new BadRequestException(
        'Ventana de 24 horas cerrada. No se puede enviar mensaje libre. El usuario debe escribir primero.',
      );
    }
    return this.sendTextMessageRaw(organizationId, dto.to, dto.text);
  }

  async sendTextMessageRaw(
    organizationId: string,
    to: string,
    text: string,
  ): Promise<{ messageId: string }> {
    const { accessToken, phoneNumberId } = await this.resolveCredentials(organizationId);
    const normalized = to.replace(/\D/g, '');
    if (!normalized) throw new BadRequestException('Número de destino inválido');
    const url = `${this.baseUrl}/${phoneNumberId}/messages`;
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
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { error?: { message: string }; messages?: Array<{ id: string }> };
    if (data.error) {
      const msg = data.error.message || 'Error al enviar mensaje por WhatsApp';
      const hint = /permission|#10/i.test(msg)
        ? ' En modo desarrollo, añade el número de destino como número de prueba en Meta for Developers (WhatsApp > Configuración).'
        : '';
      throw new BadRequestException(msg + hint);
    }
    const messageId = data.messages?.[0]?.id;
    if (!messageId) throw new BadRequestException('WhatsApp no devolvió ID de mensaje');
    return { messageId };
  }

  async getMessageTemplates(organizationId: string): Promise<MetaTemplateDto[]> {
    const { accessToken, businessAccountId } = await this.resolveCredentials(organizationId);
    if (!businessAccountId || !accessToken) {
      return [];
    }
    const url = `${this.baseUrl}/${businessAccountId}/message_templates?status=APPROVED`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
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

  async sendTemplateMessage(
    organizationId: string,
    to: string,
    templateName: string,
    language: string,
    bodyParams: string[],
  ): Promise<{ messageId: string }> {
    const { accessToken, phoneNumberId } = await this.resolveCredentials(organizationId);
    const normalized = to.replace(/\D/g, '');
    if (!normalized) throw new BadRequestException('Número de destino inválido');
    const url = `${this.baseUrl}/${phoneNumberId}/messages`;
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
        Authorization: `Bearer ${accessToken}`,
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

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const expectedToken = this.config.get<string>('WHATSAPP_VERIFY_TOKEN', '');
    if (mode === 'subscribe' && token === expectedToken) return challenge;
    return null;
  }

  /** Resuelve organización por phone_number_id del webhook; fallback a DEFAULT_ORGANIZATION_ID + env. */
  async resolveOrganizationIdFromWebhookPhoneNumberId(
    phoneNumberId: string | undefined,
  ): Promise<string | null> {
    if (!phoneNumberId) return null;
    const org = await this.prisma.organization.findFirst({
      where: { whatsappPhoneNumberId: phoneNumberId },
    });
    if (org) return org.id;
    const envId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID', '');
    if (envId && envId === phoneNumberId) {
      return (
        this.config.get<string>('DEFAULT_ORGANIZATION_ID', '') || 'org_default_migration'
      );
    }
    return null;
  }
}
