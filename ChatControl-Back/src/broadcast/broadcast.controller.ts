import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BroadcastService } from './broadcast.service';
import { SendBroadcastDto } from './dto/send-broadcast.dto';
import { GenerateBroadcastMessageDto } from './dto/generate-message.dto';

@Controller('broadcast')
@UseGuards(JwtAuthGuard)
export class BroadcastController {
  constructor(private readonly broadcast: BroadcastService) {}

  /** Lista contactos permitidos para mensajes masivos (han escrito antes) con estado 24h */
  @Get('contacts')
  async getContacts() {
    return this.broadcast.getContacts();
  }

  /** Lista plantillas (desde BD, usadas en Plantilla aprobada). */
  @Get('templates')
  async getTemplates() {
    return this.broadcast.getTemplates();
  }

  /** Genera mensaje con IA. No envía; el usuario debe confirmar en el frontend. */
  @Post('generate-message')
  async generateMessage(@Body() dto: GenerateBroadcastMessageDto) {
    const { text, usedFallbackModel } = await this.broadcast.generateMessage(dto.instruction);
    return { text, usedFallbackModel };
  }

  /** Envía mensaje masivo. Valida 24h según tipo; emite eventos WebSocket de progreso. */
  @Post('send')
  async send(@Body() dto: SendBroadcastDto) {
    return this.broadcast.sendBroadcast({
      conversationIds: dto.conversationIds,
      type: dto.type,
      text: dto.text ?? '',
      templateId: dto.templateId,
      templateVariables: dto.templateVariables,
    });
  }
}
