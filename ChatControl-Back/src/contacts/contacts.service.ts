import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ContactDto {
  id: string;
  phone: string;
  name: string | null;
  isSandboxAuthorized: boolean;
  createdAt: number;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string): Promise<ContactDto[]> {
    const list = await this.prisma.contact.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return list.map((c) => ({
      id: c.id,
      phone: c.phone,
      name: c.name,
      isSandboxAuthorized: c.isSandboxAuthorized,
      createdAt: c.createdAt.getTime(),
    }));
  }

  async createOrUpdate(
    organizationId: string,
    params: {
      phone: string;
      name?: string;
      isSandboxAuthorized?: boolean;
    },
  ): Promise<ContactDto> {
    const phone = normalizePhone(params.phone);
    if (!phone) throw new BadRequestException('El número no puede estar vacío');
    const contact = await this.prisma.contact.upsert({
      where: {
        organizationId_phone: { organizationId, phone },
      },
      create: {
        organizationId,
        phone,
        name: params.name?.trim() || null,
        isSandboxAuthorized: params.isSandboxAuthorized ?? false,
      },
      update: {
        name: params.name !== undefined ? params.name?.trim() || null : undefined,
        isSandboxAuthorized: params.isSandboxAuthorized ?? undefined,
      },
    });
    const existing = await this.prisma.conversation.findFirst({
      where: { contactId: contact.id },
    });
    if (!existing) {
      await this.prisma.conversation.create({
        data: { contactId: contact.id },
      });
    }
    return {
      id: contact.id,
      phone: contact.phone,
      name: contact.name,
      isSandboxAuthorized: contact.isSandboxAuthorized,
      createdAt: contact.createdAt.getTime(),
    };
  }

  async update(
    organizationId: string,
    id: string,
    params: { name?: string; isSandboxAuthorized?: boolean },
  ): Promise<ContactDto> {
    const existing = await this.prisma.contact.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Contacto no encontrado');
    const contact = await this.prisma.contact.update({
      where: { id },
      data: {
        name: params.name !== undefined ? params.name?.trim() || null : undefined,
        isSandboxAuthorized: params.isSandboxAuthorized ?? undefined,
      },
    });
    return {
      id: contact.id,
      phone: contact.phone,
      name: contact.name,
      isSandboxAuthorized: contact.isSandboxAuthorized,
      createdAt: contact.createdAt.getTime(),
    };
  }

  async findOne(organizationId: string, id: string): Promise<ContactDto | null> {
    const contact = await this.prisma.contact.findFirst({
      where: { id, organizationId },
    });
    if (!contact) return null;
    return {
      id: contact.id,
      phone: contact.phone,
      name: contact.name,
      isSandboxAuthorized: contact.isSandboxAuthorized,
      createdAt: contact.createdAt.getTime(),
    };
  }
}
