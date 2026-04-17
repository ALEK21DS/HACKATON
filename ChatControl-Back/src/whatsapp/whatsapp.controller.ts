import {
  Body,
  Controller,
  Get,
  Inject,
  Logger,
  Post,
  Query,
  Res,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { Response } from 'express';
import { WhatsAppService } from './whatsapp.service';
import { ChatService } from '../chat/chat.service';

@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

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
    res.status(200).send('OK');

    const value = body as { object?: string; entry?: Array<Record<string, unknown>> };
    if (value.object !== 'whatsapp_business_account' || !Array.isArray(value.entry)) return;

    for (const entry of value.entry) {
      const changes = entry.changes as Array<{ value?: Record<string, unknown> }> | undefined;
      if (!changes) continue;
      for (const change of changes) {
        const val = change.value as
          | {
              messages?: Array<{
                from: string;
                id: string;
                timestamp: string;
                type: string;
                text?: { body: string };
              }>;
              metadata?: { phone_number_id?: string };
            }
          | undefined;
        if (!val?.messages) continue;
        const phoneNumberId = val.metadata?.phone_number_id;
        const organizationId =
          await this.whatsapp.resolveOrganizationIdFromWebhookPhoneNumberId(phoneNumberId);
        if (!organizationId) {
          this.logger.warn(`Webhook sin organización para phone_number_id=${phoneNumberId}`);
          continue;
        }
        for (const msg of val.messages) {
          if (msg.type === 'text' && msg.text?.body) {
            await this.chat.registerIncomingMessage({
              organizationId,
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
