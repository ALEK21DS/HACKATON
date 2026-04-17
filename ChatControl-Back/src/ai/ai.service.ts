import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';
import { SecretsCryptoService } from '../common/secrets-crypto.service';
import { SettingsService } from '../settings/settings.service';

export interface AiGenerateResult {
  text: string;
  usedFallbackModel?: boolean;
}

@Injectable()
export class AiService {
  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
    private readonly crypto: SecretsCryptoService,
  ) {}

  private async getApiKeyForOrg(organizationId: string): Promise<string> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { credentials: true },
    });
    if (org?.credentials?.geminiApiKeyEnc) {
      try {
        const k = this.crypto.decrypt(org.credentials.geminiApiKeyEnc);
        if (k.trim()) return k.trim();
      } catch {
        /* fall through */
      }
    }
    const envKey = this.config.get<string>('GEMINI_API_KEY', '')?.trim();
    return envKey || '';
  }

  private async getGenAI(organizationId: string): Promise<GoogleGenerativeAI | null> {
    const apiKey = await this.getApiKeyForOrg(organizationId);
    if (!apiKey) return null;
    return new GoogleGenerativeAI(apiKey);
  }

  async generateReply(organizationId: string, context: string): Promise<AiGenerateResult> {
    const genAI = await this.getGenAI(organizationId);
    if (!genAI) {
      throw new Error('API key de Gemini no configurada (integraciones o GEMINI_API_KEY en .env)');
    }
    const modelId = await this.settings.getGeminiModel(organizationId);
    const prompt = `Eres un asistente de atención al cliente por WhatsApp. Responde de forma breve, profesional y útil. Solo texto, sin markdown ni emojis innecesarios.

Contexto de la conversación:
${context || '(Sin mensajes previos)'}

Responde como agente (una sola respuesta):`;

    const callWithModel = async (mId: string): Promise<string> => {
      const model = genAI.getGenerativeModel({ model: mId });
      const result = await model.generateContent(prompt);
      const text = result.response.text?.()?.trim() ?? '';
      return text || 'No pude generar una respuesta. Intenta de nuevo.';
    };

    try {
      const text = await callWithModel(modelId);
      return { text };
    } catch (err) {
      const fallback = this.settings.getFallbackGeminiModel();
      if (modelId === fallback) throw err;
      try {
        const text = await callWithModel(fallback);
        await this.settings.setGeminiModelInUse(organizationId, fallback);
        return { text, usedFallbackModel: true };
      } catch (fallbackErr) {
        const msg = err instanceof Error ? err.message : String(err);
        const is429 = msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests');
        if (is429) {
          throw new Error(
            'Cuota de Gemini excedida. Espera unos minutos o revisa tu plan en https://ai.google.dev',
          );
        }
        throw err;
      }
    }
  }

  async generateFromInstruction(organizationId: string, instruction: string): Promise<AiGenerateResult> {
    const genAI = await this.getGenAI(organizationId);
    if (!genAI) {
      throw new Error('API key de Gemini no configurada (integraciones o GEMINI_API_KEY en .env)');
    }
    const modelId = await this.settings.getGeminiModel(organizationId);
    const prompt = `Eres un redactor de mensajes para WhatsApp. Genera UN SOLO mensaje de texto que cumpla la instrucción del usuario.

Reglas:
- El mensaje debe ser COMPLETO: desarrolla la idea (saludos, bienvenidas, promociones, etc.), no respondas con una sola palabra como "Hola".
- Longitud: entre 2 y 5 oraciones, claro y profesional. Sin markdown ni emojis innecesarios.
- Solo texto plano, listo para copiar y enviar.

Instrucción del usuario: ${instruction?.trim() || 'Escribe un mensaje amigable y profesional.'}

Mensaje generado:`;

    const callWithModel = async (mId: string): Promise<string> => {
      const model = genAI.getGenerativeModel({ model: mId });
      const result = await model.generateContent(prompt);
      const text = result.response.text?.()?.trim() ?? '';
      return text || 'No pude generar el mensaje. Intenta con otra instrucción.';
    };

    try {
      const text = await callWithModel(modelId);
      return { text };
    } catch (err) {
      const fallback = this.settings.getFallbackGeminiModel();
      if (modelId === fallback) throw err;
      try {
        const text = await callWithModel(fallback);
        await this.settings.setGeminiModelInUse(organizationId, fallback);
        return { text, usedFallbackModel: true };
      } catch {
        throw err;
      }
    }
  }
}
