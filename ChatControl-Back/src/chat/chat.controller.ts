import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { IsNotEmpty, IsString } from 'class-validator';

class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  async getConversations() {
    return this.chat.getConversations();
  }

  @Get('conversations/:id')
  async getConversation(@Param('id') id: string) {
    const conv = await this.chat.getConversation(id);
    if (!conv) return { ok: false, conversation: null };
    const [canSend, windowSecondsRemaining] = await Promise.all([
      this.chat.canSendToConversation(id),
      this.chat.getWindowSecondsRemaining(id),
    ]);
    return {
      ok: true,
      conversation: conv,
      canSend,
      windowSecondsRemaining,
    };
  }

  @Get('conversations/:id/messages')
  async getMessages(@Param('id') id: string) {
    return this.chat.getMessages(id);
  }

  @Patch('conversations/:id/read')
  async markAsRead(@Param('id') id: string) {
    await this.chat.markConversationAsRead(id);
    return { ok: true };
  }

  @Get('conversations/:id/can-send')
  async canSend(@Param('id') id: string) {
    const [canSend, windowSecondsRemaining] = await Promise.all([
      this.chat.canSendToConversation(id),
      this.chat.getWindowSecondsRemaining(id),
    ]);
    return { canSend, windowSecondsRemaining };
  }

  @Post('conversations/:id/send')
  async sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto) {
    const msg = await this.chat.sendMessage({
      conversationId: id,
      text: dto.text,
    });
    return { ok: true, message: msg };
  }

  /** Generar respuesta con IA (no envía; el frontend decide enviar o editar) */
  @Post('conversations/:id/generate-reply')
  async generateReply(@Param('id') id: string) {
    const { text, usedFallbackModel } = await this.chat.generateAiReply(id);
    return { ok: true, text, usedFallbackModel };
  }
}
