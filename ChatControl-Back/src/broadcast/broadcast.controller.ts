import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
  async getContacts(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('campaignIds') campaignIds?: string,
  ) {
    return this.broadcast.getContacts(
      user.organizationId!,
      user.userId,
      user.role,
      { q, campaignIds: campaignIds ? campaignIds.split(',').filter(Boolean) : undefined },
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('contacts/ids')
  async getContactIds(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('onlyCanSend') onlyCanSend?: string,
    @Query('campaignIds') campaignIds?: string,
  ) {
    const ids = await this.broadcast.getAllContactIds(user.organizationId!, user.userId, user.role, {
      q,
      onlyCanSend: onlyCanSend === 'true',
      campaignIds: campaignIds ? campaignIds.split(',').filter(Boolean) : undefined,
    });
    return { ids };
  }

  @Post('campaign-contacts')
  async getCampaignContacts(@CurrentUser() user: AuthUser, @Body() body: { campaignIds: string[] }) {
    const byCampaign = await this.broadcast.getCampaignConversationMap(
      user.organizationId!,
      body.campaignIds ?? [],
      user.userId,
      user.role,
    );
    return { ok: true, byCampaign };
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

  @Get('audit/assignments')
  async getAssignmentAudit(@CurrentUser() user: AuthUser) {
    return this.broadcast.getAssignmentAuditLogs(user.organizationId!);
  }

  @Get('audit/broadcast')
  async getBroadcastAudit(@CurrentUser() user: AuthUser) {
    return this.broadcast.getBroadcastAuditLogs(user.organizationId!);
  }
}
