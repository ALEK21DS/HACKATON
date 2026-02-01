import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  async findAll() {
    return this.contacts.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const contact = await this.contacts.findOne(id);
    if (!contact) return { ok: false, contact: null };
    return { ok: true, contact };
  }

  @Post()
  async create(@Body() dto: CreateContactDto) {
    const contact = await this.contacts.createOrUpdate({
      phone: dto.phone,
      name: dto.name,
      isSandboxAuthorized: dto.isSandboxAuthorized ?? false,
    });
    return { ok: true, contact };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    const contact = await this.contacts.update(id, {
      name: dto.name,
      isSandboxAuthorized: dto.isSandboxAuthorized,
    });
    return { ok: true, contact };
  }
}
