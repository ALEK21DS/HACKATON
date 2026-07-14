import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { OrgMemberGuard } from '../auth/org-member.guard';
import { ChatService } from './chat.service';
import { StorageService } from '../common/storage.service';
import { LeadAssignmentService } from '../lead-assignment/lead-assignment.service';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}

class AssignConversationDto {
  @IsOptional()
  @IsString()
  assignToUserId?: string | null;
}

@Controller('chat')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
@Roles(UserRole.ORG_ADMIN, UserRole.AGENT)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly storage: StorageService,
    private readonly leadAssignment: LeadAssignmentService,
  ) {}

  @Get('conversations')
  async getConversations(@CurrentUser() user: AuthUser) {
    return this.chat.getConversations(user.organizationId!, user.userId, user.role);
  }

  @Get('conversations/:id')
  async getConversation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const conv = await this.chat.getConversation(id, user.organizationId!, user.userId, user.role);
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
  async getMessages(
    @CurrentUser() user: AuthUser, 
    @Param('id') id: string,
    @Query('cursor') cursor?: string
  ) {
    return this.chat.getMessages(id, user.organizationId!, cursor, user.userId, user.role);
  }

  @Get('conversations/:id/gallery')
  async getGallery(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.chat.getGallery(id, user.organizationId!, user.userId, user.role, cursor);
  }

  @Get('conversations/:id/search')
  async searchMessages(
    @CurrentUser() user: AuthUser, 
    @Param('id') id: string,
    @Query('q') query: string,
  ) {
    return this.chat.searchMessages(id, user.organizationId!, query, user.userId, user.role);
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

  @Post('conversations/:id/send-media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 16 * 1024 * 1024 } }))
  async sendMedia(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Query('type') type: string,
  ) {
    if (!file) throw new BadRequestException('Archivo no proveído');
    const validTypes = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException('Tipo de mensaje inválido. Debe ser IMAGE, VIDEO, AUDIO o DOCUMENT');
    }
    const msg = await this.chat.sendMediaMessage({
      organizationId: user.organizationId!,
      conversationId: id,
      file,
      type: type as any,
      sentByUserId: user.userId,
    });
    return { ok: true, message: msg };
  }

  @Post('conversations/:id/generate-reply')
  async generateReply(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const { text, usedFallbackModel } = await this.chat.generateAiReply(user.organizationId!, id);
    return { ok: true, text, usedFallbackModel };
  }

  @Get('lead-assignment/next-agent')
  async getNextAgent(@CurrentUser() user: AuthUser) {
    return this.leadAssignment.peekNextAgent(user.organizationId!);
  }

  @Post('conversations/backfill-assignment')
  @Roles(UserRole.ORG_ADMIN)
  async backfillAssignment(@CurrentUser() user: AuthUser) {
    return this.leadAssignment.assignHistoricalChats(user.organizationId!);
  }

  @Post('conversations/:id/assign')
  @Roles(UserRole.ORG_ADMIN)
  async assignConversation(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignConversationDto,
  ) {
    await this.chat.assignConversation(id, user.organizationId!, dto.assignToUserId ?? null);
    return { ok: true };
  }
}
