import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Res,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { Response } from 'express';
import { WhatsAppService } from './whatsapp.service';
import { ChatService } from '../chat/chat.service';

/**
 * Webhook para WhatsApp Cloud API.
 * - GET: verificación (Meta envía hub.verify_token y hub.challenge)
 * - POST: mensajes entrantes y estados
 */
@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    @Inject(forwardRef(() => ChatService)) private readonly chat: ChatService,
  ) {}

  @Get('webhook')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const result = this.whatsapp.verifyWebhook(mode, token, challenge);
    if (result != null) {
      return res.status(200).send(result);
    }
    throw new UnauthorizedException('Token de verificación inválido');
  }

  @Post('webhook')
  async webhook(@Body() body: Record<string, unknown>, @Res() res: Response) {
    // Siempre responder 200 para que Meta no reintente
    res.status(200).send('OK');

    // Procesar en segundo plano
    const value = body as { object?: string; entry?: Array<Record<string, unknown>> };
    if (value.object !== 'whatsapp_business_account' || !Array.isArray(value.entry)) return;

    for (const entry of value.entry) {
      const changes = entry.changes as Array<{ value?: Record<string, unknown> }> | undefined;
      if (!changes) continue;
      for (const change of changes) {
        if (change.value?.messages) {
          // Mensaje entrante: se procesa en ChatModule (inyectando este servicio o un evento)
          // Por ahora el webhook solo recibe; el almacenamiento y listado lo hace Chat
          const messages = change.value.messages as Array<{
            from: string;
            id: string;
            timestamp: string;
            type: string;
            text?: { body: string };
          }>;
          for (const msg of messages) {
            if (msg.type === 'text' && msg.text?.body) {
              await this.chat.registerIncomingMessage({
                from: msg.from,
                messageId: msg.id,
                timestamp: parseInt(msg.timestamp, 10) * 1000,
                text: msg.text.body,
              });
            }
          }
        }
      }
    }
  }

}
