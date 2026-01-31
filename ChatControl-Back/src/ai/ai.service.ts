import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Servicio de IA con Gemini.
 * Por ahora: UN SOLO TOKEN global desde .env.
 * TODO: Permitir que cada empresa configure su propio token de IA (multi-tenant).
 */
@Injectable()
export class AiService {
  private readonly genAI: GoogleGenerativeAI | null = null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (apiKey) this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Genera una respuesta de agente a partir del contexto reciente del chat.
   * Contexto limitado (no se envía todo el historial).
   * Reintenta una vez si hay 429 (cuota/rate limit).
   */
  async generateReply(context: string): Promise<string> {
    if (!this.genAI) {
      throw new Error('GEMINI_API_KEY no configurada. Configurar en .env');
    }
    // Modelo: gemini-2.5-flash suele tener free tier en cuentas nuevas (AI Studio); si da 404 probar gemini-pro
    const modelId = this.config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
    const model = this.genAI.getGenerativeModel({ model: modelId });
    const prompt = `Eres un asistente de atención al cliente por WhatsApp. Responde de forma breve, profesional y útil. Solo texto, sin markdown ni emojis innecesarios.

Contexto de la conversación:
${context || '(Sin mensajes previos)'}

Responde como agente (una sola respuesta):`;

    const call = async (): Promise<string> => {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text?.()?.trim() ?? '';
      return text || 'No pude generar una respuesta. Intenta de nuevo.';
    };

    try {
      return await call();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests');
      if (is429) {
        await new Promise((r) => setTimeout(r, 14000)); // esperar ~14 s antes de reintentar
        try {
          return await call();
        } catch (retryErr) {
          throw new Error(
            'Cuota de Gemini excedida. Espera unos minutos o revisa tu plan en https://ai.google.dev',
          );
        }
      }
      throw err;
    }
  }

  /**
   * Genera un mensaje a partir de una instrucción (ej. para mensajes masivos).
   * Usa GEMINI_API_KEY desde .env. Si no está configurada, lanza error.
   * TODO: token por empresa (multi-tenant).
   */
  async generateFromInstruction(instruction: string): Promise<string> {
    if (!this.genAI) {
      throw new Error('GEMINI_API_KEY no configurada. Configurar en .env');
    }
    const modelId = this.config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
    const model = this.genAI.getGenerativeModel({ model: modelId });
    const prompt = `Eres un redactor de mensajes para WhatsApp. Genera UN SOLO mensaje de texto que cumpla la instrucción del usuario.

Reglas:
- El mensaje debe ser COMPLETO: desarrolla la idea (saludos, bienvenidas, promociones, etc.), no respondas con una sola palabra como "Hola".
- Longitud: entre 2 y 5 oraciones, claro y profesional. Sin markdown ni emojis innecesarios.
- Solo texto plano, listo para copiar y enviar.

Instrucción del usuario: ${instruction?.trim() || 'Escribe un mensaje amigable y profesional.'}

Mensaje generado:`;

    const result = await model.generateContent(prompt);
    const text = result.response.text?.()?.trim() ?? '';
    return text || 'No pude generar el mensaje. Intenta con otra instrucción.';
  }
}
