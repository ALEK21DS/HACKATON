import { BadRequestException, Body, Controller, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Post('template-media')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 16 * 1024 * 1024 } }))
  async uploadTemplateMedia(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: any,
    @Body('templateId') templateId?: string,
  ) {
    if (!file) throw new BadRequestException('Archivo no proveído');
    const url = await this.broadcast.uploadTemplateHeaderMedia(user.organizationId!, file, templateId);
    return { url };
  }

  @Get('template-media/:templateId')
  async getTemplateMedia(@CurrentUser() user: AuthUser, @Param('templateId') templateId: string) {
    const saved = await this.broadcast.getTemplateHeaderMedia(user.organizationId!, templateId);
    return { saved };
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
      templateAutoNameVariables: dto.templateAutoNameVariables,
      templateHeaderValue: dto.templateHeaderValue,
      templateButtonVariables: dto.templateButtonVariables,
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

  @Get('runs')
  async getRuns(@CurrentUser() user: AuthUser) {
    const runs = await this.broadcast.getBroadcastRuns(user.organizationId!);
    return { runs };
  }

  @Get('runs/:runId/contacts')
  async getRunContacts(
    @CurrentUser() user: AuthUser,
    @Param('runId') runId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    if (status !== undefined && status !== 'sent' && status !== 'failed') {
      throw new BadRequestException('status debe ser "sent" o "failed"');
    }
    return this.broadcast.getBroadcastRunContacts(user.organizationId!, runId, {
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
      status: status as 'sent' | 'failed' | undefined,
      category,
    });
  }
}
