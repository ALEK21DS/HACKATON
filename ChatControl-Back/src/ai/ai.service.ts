import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SettingsService } from '../settings/settings.service';

export interface AiGenerateResult {
  text: string;
  usedFallbackModel?: boolean;
}

/**
 * Servicio de IA con Gemini.
 * Usa el modelo configurado en Settings; si falla (ej. modelo de pago sin suscripción), recurre a gemini-2.5-flash.
 */
@Injectable()
export class AiService {
  private readonly genAI: GoogleGenerativeAI | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (apiKey) this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Genera una respuesta de agente a partir del contexto reciente del chat.
   * Usa el modelo configurado; si falla, recurre a gemini-2.5-flash y devuelve usedFallbackModel: true.
   */
  async generateReply(context: string): Promise<AiGenerateResult> {
    if (!this.genAI) {
      throw new Error('GEMINI_API_KEY no configurada. Configurar en .env');
    }
    const modelId = await this.settings.getGeminiModel();
    const prompt = `Eres un asistente de atención al cliente por WhatsApp. Responde de forma breve, profesional y útil. Solo texto, sin markdown ni emojis innecesarios.

Contexto de la conversación:
${context || '(Sin mensajes previos)'}

Responde como agente (una sola respuesta):`;

    const callWithModel = async (mId: string): Promise<string> => {
      const model = this.genAI!.getGenerativeModel({ model: mId });
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
        await this.settings.setGeminiModelInUse(fallback);
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

  /**
   * Genera un mensaje a partir de una instrucción (ej. para mensajes masivos).
   * Usa el modelo configurado; si falla, recurre a gemini-2.5-flash.
   */
  async generateFromInstruction(instruction: string): Promise<AiGenerateResult> {
    if (!this.genAI) {
      throw new Error('GEMINI_API_KEY no configurada. Configurar en .env');
    }
    const modelId = await this.settings.getGeminiModel();
    const prompt = `Eres un redactor de mensajes para WhatsApp. Genera UN SOLO mensaje de texto que cumpla la instrucción del usuario.

Reglas:
- El mensaje debe ser COMPLETO: desarrolla la idea (saludos, bienvenidas, promociones, etc.), no respondas con una sola palabra como "Hola".
- Longitud: entre 2 y 5 oraciones, claro y profesional. Sin markdown ni emojis innecesarios.
- Solo texto plano, listo para copiar y enviar.

Instrucción del usuario: ${instruction?.trim() || 'Escribe un mensaje amigable y profesional.'}

Mensaje generado:`;

    const callWithModel = async (mId: string): Promise<string> => {
      const model = this.genAI!.getGenerativeModel({ model: mId });
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
        await this.settings.setGeminiModelInUse(fallback);
        return { text, usedFallbackModel: true };
      } catch {
        throw err;
      }
    }
  }
}
