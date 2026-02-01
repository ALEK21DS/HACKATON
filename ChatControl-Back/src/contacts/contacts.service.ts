import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Contacto para listado y formulario. TODO: eliminar isSandboxAuthorized en producción. */
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

  async findAll(): Promise<ContactDto[]> {
    const list = await this.prisma.contact.findMany({
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

  /**
   * Crea o actualiza contacto por número (upsert).
   * Solo pruebas: isSandboxAuthorized indica si el número está autorizado en Meta.
   * TODO: eliminar isSandboxAuthorized en producción.
   */
  async createOrUpdate(params: {
    phone: string;
    name?: string;
    isSandboxAuthorized?: boolean;
  }): Promise<ContactDto> {
    const phone = normalizePhone(params.phone);
    if (!phone) throw new BadRequestException('El número no puede estar vacío');
    const contact = await this.prisma.contact.upsert({
      where: { phone },
      create: {
        phone,
        name: params.name?.trim() || null,
        isSandboxAuthorized: params.isSandboxAuthorized ?? false,
      },
      update: {
        name: params.name !== undefined ? (params.name?.trim() || null) : undefined,
        isSandboxAuthorized: params.isSandboxAuthorized ?? undefined,
      },
    });
    // Crear una conversación inicial si no existe (para que aparezca en Mensajes Masivos)
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
    id: string,
    params: { name?: string; isSandboxAuthorized?: boolean },
  ): Promise<ContactDto> {
    const contact = await this.prisma.contact.update({
      where: { id },
      data: {
        name: params.name !== undefined ? (params.name?.trim() || null) : undefined,
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

  async findOne(id: string): Promise<ContactDto | null> {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
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
