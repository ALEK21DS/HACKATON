import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { OrgMemberGuard } from '../auth/org-member.guard';
import { BroadcastService } from './broadcast.service';
import { SendBroadcastDto } from './dto/send-broadcast.dto';
import { GenerateBroadcastMessageDto } from './dto/generate-message.dto';

@Controller('broadcast')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
@Roles(UserRole.ORG_ADMIN, UserRole.AGENT)
export class BroadcastController {
  constructor(private readonly broadcast: BroadcastService) {}

  @Get('contacts')
  async getContacts(@CurrentUser() user: AuthUser) {
    return this.broadcast.getContacts(user.organizationId!, user.userId, user.role);
  }

  @Get('templates')
  async getTemplates(@CurrentUser() user: AuthUser) {
    return this.broadcast.getTemplates(user.organizationId!);
  }

  @Post('generate-message')
  async generateMessage(@CurrentUser() user: AuthUser, @Body() dto: GenerateBroadcastMessageDto) {
    const { text, usedFallbackModel } = await this.broadcast.generateMessage(
      user.organizationId!,
      dto.instruction,
    );
    return { text, usedFallbackModel };
  }

  @Post('send')
  async send(@CurrentUser() user: AuthUser, @Body() dto: SendBroadcastDto) {
    return this.broadcast.sendBroadcast({
      organizationId: user.organizationId!,
      userId: user.userId,
      conversationIds: dto.conversationIds,
      type: dto.type,
      text: dto.text ?? '',
      templateId: dto.templateId,
      templateVariables: dto.templateVariables,
    });
  }
}
