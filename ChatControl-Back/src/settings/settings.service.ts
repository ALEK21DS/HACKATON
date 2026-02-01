import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageDirection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type WhatsappTier = 'new' | 'level1' | 'level2' | 'level3' | 'excellent';

const TIER_DAILY_LIMITS: Record<WhatsappTier, number> = {
  new: 250,
  level1: 1_000,
  level2: 10_000,
  level3: 100_000,
  excellent: Number.MAX_SAFE_INTEGER, // Ilimitado
};

/** Modelo gratuito por defecto cuando no hay nada en BD ni en .env */
const DEFAULT_FALLBACK_GEMINI_MODEL = 'gemini-2.5-flash';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async get(key: string): Promise<string | null> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key },
    });
    return row?.value ?? null;
  }

  private async set(key: string, value: string): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  async getWhatsappTier(): Promise<WhatsappTier> {
    const v = await this.get('whatsapp_tier');
    if (v && (v === 'new' || v === 'level1' || v === 'level2' || v === 'level3' || v === 'excellent'))
      return v as WhatsappTier;
    return 'new';
  }

  async setWhatsappTier(tier: WhatsappTier): Promise<void> {
    await this.set('whatsapp_tier', tier);
  }

  /** Límite diario de conversaciones según el tier (excellent = ilimitado). */
  async getDailyLimit(): Promise<number> {
    const tier = await this.getWhatsappTier();
    return TIER_DAILY_LIMITS[tier];
  }

  /** Cantidad de conversaciones distintas a las que se envió al menos un mensaje en las últimas 24 h. */
  async getDailyConversationCount(): Promise<number> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        direction: MessageDirection.OUT,
        whatsappTimestamp: { gte: since },
      },
      _count: { conversationId: true },
    });
    return result.length;
  }

  /**
   * Verifica si se puede enviar a esta conversación sin superar el límite diario.
   * Si esta conversación no ha recibido mensajes nuestros en las últimas 24 h, cuenta como nueva.
   */
  async checkDailyLimitOrThrow(conversationId: string): Promise<void> {
    const limit = await this.getDailyLimit();
    if (limit === Number.MAX_SAFE_INTEGER) return;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const alreadySentToThis = await this.prisma.message.findFirst({
      where: {
        conversationId,
        direction: MessageDirection.OUT,
        whatsappTimestamp: { gte: since },
      },
    });

    if (alreadySentToThis) return; // Ya contó esta conversación hoy

    const count = await this.getDailyConversationCount();
    if (count >= limit) {
      throw new ForbiddenException(
        'No puedes agregar más conversaciones, has superado el límite diario de tu tier.',
      );
    }
  }

  /**
   * Modelo de Gemini a usar. Origen de datos:
   * 1) Lo que el administrador guardó en Configuración (BD).
   * 2) Si no hay nada guardado: GEMINI_MODEL del .env (ej. gemini-2.5-flash).
   * 3) Si tampoco está en .env: gemini-2.5-flash por defecto.
   */
  async getGeminiModel(): Promise<string> {
    const v = await this.get('gemini_model');
    if (v?.trim()) return v.trim();
    const envModel = this.config.get<string>('GEMINI_MODEL')?.trim();
    return envModel || DEFAULT_FALLBACK_GEMINI_MODEL;
  }

  async setGeminiModel(model: string): Promise<void> {
    await this.set('gemini_model', model.trim());
    await this.set('gemini_model_in_use', model.trim()); // reset fallback
  }

  /** Modelo actualmente en uso (puede ser el gratuito si hubo fallback). */
  async getGeminiModelInUse(): Promise<string> {
    const v = await this.get('gemini_model_in_use');
    if (v?.trim()) return v.trim();
    const envModel = this.config.get<string>('GEMINI_MODEL')?.trim();
    return envModel || DEFAULT_FALLBACK_GEMINI_MODEL;
  }

  async setGeminiModelInUse(model: string): Promise<void> {
    await this.set('gemini_model_in_use', model);
  }

  /** Modelo al que se recurre si el configurado falla (ej. modelo de pago sin suscripción). */
  getFallbackGeminiModel(): string {
    const envModel = this.config.get<string>('GEMINI_MODEL')?.trim();
    return envModel || DEFAULT_FALLBACK_GEMINI_MODEL;
  }
}
