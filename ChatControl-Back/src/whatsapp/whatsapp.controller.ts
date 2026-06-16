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
import { StorageService } from '../common/storage.service';
import { MessageType } from '@prisma/client';

@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly storage: StorageService,
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

    try {
      const fs = require('fs');
      fs.appendFileSync('webhook-debug.log', JSON.stringify({ timestamp: new Date().toISOString(), body }, null, 2) + '\n---\n');
    } catch (e) {}

    const value = body as { object?: string; entry?: Array<Record<string, unknown>> };
    if (value.object !== 'whatsapp_business_account' || !Array.isArray(value.entry)) return;

    for (const entry of value.entry) {
      const changes = entry.changes as Array<{ value?: Record<string, unknown> }> | undefined;
      if (!changes) continue;
      for (const change of changes) {
        const val = change.value as
          | {
              contacts?: Array<{
                profile?: { name: string };
                wa_id: string;
              }>;
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
        const contactsList = val.contacts || [];
        for (const msg of val.messages) {
          const pushName = contactsList.find(c => c.wa_id === msg.from)?.profile?.name;
          const isMedia = ['image', 'video', 'audio', 'document', 'sticker'].includes(msg.type);

          if (msg.type === 'text' && msg.text?.body) {
            await this.chat.registerIncomingMessage({
              organizationId,
              from: msg.from,
              contactName: pushName,
              messageId: msg.id,
              timestamp: parseInt(msg.timestamp, 10) * 1000,
              text: msg.text.body,
              type: MessageType.TEXT,
            });
          } else if (isMedia) {
            const mediaData = (msg as any)[msg.type];
            if (mediaData && mediaData.id) {
              const mediaId = mediaData.id;
              const downloaded = await this.whatsapp.downloadMedia(mediaId, organizationId);
              if (downloaded) {
                const extension = downloaded.mimeType.split('/')[1] || 'bin';
                const path = `chats/${organizationId}/${mediaId}.${extension}`;
                const mediaUrl = await this.storage.uploadFile('chat-media', path, downloaded.buffer, downloaded.mimeType);
                if (mediaUrl) {
                  let dbType: MessageType = msg.type.toUpperCase() as MessageType;
                  if (msg.type === 'sticker') {
                    dbType = MessageType.IMAGE;
                  }
                  await this.chat.registerIncomingMessage({
                    organizationId,
                    from: msg.from,
                    contactName: pushName,
                    messageId: msg.id,
                    timestamp: parseInt(msg.timestamp, 10) * 1000,
                    text: '', // Mensajes de medios no tienen texto por defecto, a menos que tengan caption.
                    type: dbType,
                    mediaUrl,
                    mimeType: downloaded.mimeType,
                    fileName: mediaData.filename || undefined,
                  });
                } else {
                  this.logger.error(`No se pudo subir a Supabase el archivo de WhatsApp ${mediaId}`);
                }
              } else {
                this.logger.error(`No se pudo descargar de WhatsApp el archivo ${mediaId}`);
              }
            }
          }
        }
      }
    }
  }
}
