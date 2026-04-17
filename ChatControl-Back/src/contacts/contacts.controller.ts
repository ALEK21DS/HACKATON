import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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
  async findAll(@CurrentUser() user: AuthUser) {
    return this.contacts.findAll(user.organizationId!);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const contact = await this.contacts.findOne(user.organizationId!, id);
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
}
