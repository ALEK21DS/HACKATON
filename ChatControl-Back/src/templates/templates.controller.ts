import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TemplatesService } from './templates.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(
    private readonly templates: TemplatesService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  @Get()
  async findAll() {
    return this.templates.findAll();
  }

  /** Plantillas aprobadas de la cuenta de WhatsApp Business (Meta). Ruta 'from-meta' para no colisionar con :id. */
  @Get('from-meta')
  async getMetaTemplates() {
    return this.whatsapp.getMessageTemplates();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const template = await this.templates.findOne(id);
    if (!template) return { ok: false, template: null };
    return { ok: true, template };
  }

  @Post()
  async create(@Body() dto: CreateTemplateDto) {
    const template = await this.templates.create({
      name: dto.name,
      body: dto.body,
    });
    return { ok: true, template };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    const template = await this.templates.update(id, {
      name: dto.name,
      body: dto.body,
    });
    return { ok: true, template };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.templates.remove(id);
    return { ok: true };
  }
}
