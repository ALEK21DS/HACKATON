import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { OrgMemberGuard } from '../auth/org-member.guard';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller('contacts')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
@Roles(UserRole.ORG_ADMIN, UserRole.AGENT)
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('campaignIds') campaignIds?: string,
  ) {
    return this.contacts.findAll(
      user.organizationId!,
      user.userId,
      user.role,
      { q, campaignIds: campaignIds ? campaignIds.split(',').filter(Boolean) : undefined },
      cursor,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('ids')
  async findAllIds(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('campaignIds') campaignIds?: string,
  ) {
    const ids = await this.contacts.findAllIds(user.organizationId!, user.userId, user.role, {
      q,
      campaignIds: campaignIds ? campaignIds.split(',').filter(Boolean) : undefined,
    });
    return { ids };
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const contact = await this.contacts.findOne(user.organizationId!, id, user.userId, user.role);
    if (!contact) return { ok: false, contact: null };
    return { ok: true, contact };
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateContactDto) {
    const contact = await this.contacts.createOrUpdate(user.organizationId!, {
      phone: dto.phone,
      name: dto.name,
      isSandboxAuthorized: dto.isSandboxAuthorized ?? false,
    });
    return { ok: true, contact };
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateContactDto) {
    const contact = await this.contacts.update(user.organizationId!, id, {
      name: dto.name,
      isSandboxAuthorized: dto.isSandboxAuthorized,
    });
    return { ok: true, contact };
  }

  @Post('export')
  async exportContacts(
    @CurrentUser() user: AuthUser,
    @Body() body: { contactIds: string[]; campaignIds?: string[] },
  ) {
    const rows = await this.contacts.exportContacts(
      user.organizationId!,
      body.contactIds,
      user.userId,
      user.role,
    );

    let byCampaign: Array<{
      campaign: any;
      contacts: any[];
    }> = [];

    if (body.campaignIds && body.campaignIds.length > 0) {
      const campaigns = await this.contacts.getExportGroupedByCampaign(
        user.organizationId!,
        body.campaignIds,
        body.contactIds,
        user.userId,
        user.role,
      );
      byCampaign = campaigns;
    }

    return { ok: true, rows, byCampaign };
  }

  @Post('campaign-contacts')
  async getCampaignContacts(
    @CurrentUser() user: AuthUser,
    @Body() body: { campaignIds: string[] },
  ) {
    const map = await this.contacts.getCampaignContacts(
      user.organizationId!,
      body.campaignIds,
    );
    return { ok: true, byCampaign: map };
  }
}
