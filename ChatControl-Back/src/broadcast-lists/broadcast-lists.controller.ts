import { Controller, Get, Param, Delete, Post, Body, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrgMemberGuard } from '../auth/org-member.guard';
import type { AuthUser } from '../auth/auth.types';
import { BroadcastListsService } from './broadcast-lists.service';

@Controller('broadcast-lists')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
@Roles(UserRole.ORG_ADMIN, UserRole.AGENT)
export class BroadcastListsController {
  constructor(private readonly service: BroadcastListsService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.organizationId!, user.userId, user.role);
  }

  @Get('crm')
  async findCrmLists(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.organizationId!, user.userId, user.role, true);
  }

  @Post('preview')
  async preview(
    @CurrentUser() user: AuthUser,
    @Body() body: { listIds: string[] },
  ) {
    return this.service.previewLists(
      user.organizationId!,
      body.listIds || [],
      user.userId,
      user.role,
    );
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(user.organizationId!, id);
  }

  @Get(':id/contacts')
  async getContactIdsForBroadcast(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const conversationIds = await this.service.findContactsForBroadcast(user.organizationId!, id);
    return { conversationIds, total: conversationIds.length };
  }

  @Delete(':id')
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.service.delete(user.organizationId!, id);
    return { ok: true };
  }
}
