import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { OrgMemberGuard } from '../auth/org-member.guard';
import { ChatService } from './chat.service';
import { IsNotEmpty, IsString } from 'class-validator';

class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}

@Controller('chat')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
@Roles(UserRole.ORG_ADMIN, UserRole.AGENT)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  async getConversations(@CurrentUser() user: AuthUser) {
    return this.chat.getConversations(user.organizationId!);
  }

  @Get('conversations/:id')
  async getConversation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const conv = await this.chat.getConversation(id, user.organizationId!);
    if (!conv) return { ok: false, conversation: null };
    const [canSend, windowSecondsRemaining] = await Promise.all([
      this.chat.canSendToConversation(id, user.organizationId!),
      this.chat.getWindowSecondsRemaining(id, user.organizationId!),
    ]);
    return {
      ok: true,
      conversation: conv,
      canSend,
      windowSecondsRemaining,
    };
  }

  @Get('conversations/:id/messages')
  async getMessages(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.getMessages(id, user.organizationId!);
  }

  @Patch('conversations/:id/read')
  async markAsRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.chat.markConversationAsRead(id, user.organizationId!);
    return { ok: true };
  }

  @Get('conversations/:id/can-send')
  async canSend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const [canSend, windowSecondsRemaining] = await Promise.all([
      this.chat.canSendToConversation(id, user.organizationId!),
      this.chat.getWindowSecondsRemaining(id, user.organizationId!),
    ]);
    return { canSend, windowSecondsRemaining };
  }

  @Post('conversations/:id/send')
  async sendMessage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SendMessageDto) {
    const msg = await this.chat.sendMessage({
      organizationId: user.organizationId!,
      conversationId: id,
      text: dto.text,
      sentByUserId: user.userId,
    });
    return { ok: true, message: msg };
  }

  @Post('conversations/:id/generate-reply')
  async generateReply(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { text, usedFallbackModel } = await this.chat.generateAiReply(user.organizationId!, id);
    return { ok: true, text, usedFallbackModel };
  }
}
