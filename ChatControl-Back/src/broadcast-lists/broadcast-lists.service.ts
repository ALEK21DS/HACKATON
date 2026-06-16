import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';

export interface BroadcastListDto {
  id: string;
  name: string;
  source: string;
  contactCount: number;
  crmExportedAt: number | null;
  createdAt: number;
  assignedToUserId: string | null;
}

export interface BroadcastListDetailDto extends BroadcastListDto {
  contacts: Array<{
    id: string;
    contactId: string;
    phone: string;
    name: string | null;
    externalId: string | null;
    campaign: string | null;
    seller: string | null;
    canSend: boolean;
    windowSecondsRemaining: number;
    isSandboxAuthorized: boolean;
  }>;
}

@Injectable()
export class BroadcastListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
  ) {}

  async findAll(
    organizationId: string,
    userId?: string,
    userRole?: string,
    crmOnly = false,
  ): Promise<BroadcastListDto[]> {
    const where: {
      organizationId: string;
      source?: string;
      assignedToUserId?: string;
    } = { organizationId };

    if (crmOnly) {
      where.source = 'crm';
    }
    if (userRole === UserRole.AGENT && userId) {
      where.assignedToUserId = userId;
    }

    const allLists = await this.prisma.broadcastList.findMany({
      where: { organizationId },
    });
    console.log('[BroadcastLists] todas las listas en org', organizationId, ':', allLists.map(l => ({ id: l.id, name: l.name, source: l.source, contactCount: l.contactCount, assignedToUserId: l.assignedToUserId })));

    const lists = await this.prisma.broadcastList.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
    console.log('[BroadcastLists] lista filtrada (crmOnly=' + crmOnly + ', role=' + userRole + ', userId=' + userId + '):', lists.map(l => ({ id: l.id, name: l.name, source: l.source })));
    return lists.map((l) => ({
      id: l.id,
      name: l.name,
      source: l.source,
      contactCount: l.contactCount,
      crmExportedAt: l.crmExportedAt?.getTime() ?? null,
      createdAt: l.createdAt.getTime(),
      assignedToUserId: l.assignedToUserId,
    }));
  }

  async findOne(organizationId: string, id: string): Promise<BroadcastListDetailDto> {
    const list = await this.prisma.broadcastList.findFirst({
      where: { id, organizationId },
    });
    if (!list) throw new NotFoundException('Lista no encontrada');

    const listContacts = await this.prisma.broadcastListContact.findMany({
      where: { listId: id },
      include: {
        contact: true,
      },
    });

    return {
      id: list.id,
      name: list.name,
      source: list.source,
      contactCount: list.contactCount,
      crmExportedAt: list.crmExportedAt?.getTime() ?? null,
      createdAt: list.createdAt.getTime(),
      assignedToUserId: list.assignedToUserId,
      contacts: listContacts.map(lc => ({
        id: lc.id,
        contactId: lc.contactId,
        phone: lc.contact.phone,
        name: lc.contact.name,
        externalId: lc.externalId,
        campaign: lc.campaign,
        seller: lc.seller,
        canSend: true,
        windowSecondsRemaining: 0,
        isSandboxAuthorized: lc.contact.isSandboxAuthorized,
      })),
    };
  }

  async findContactsForBroadcast(organizationId: string, listId: string): Promise<string[]> {
    const list = await this.prisma.broadcastList.findFirst({
      where: { id: listId, organizationId },
    });
    if (!list) throw new NotFoundException('Lista no encontrada');

    const links = await this.prisma.broadcastListContact.findMany({
      where: { listId },
      include: { contact: true },
    });

    const conversationIds: string[] = [];
    for (const link of links) {
      const conv = await this.prisma.conversation.findFirst({
        where: { contactId: link.contactId },
      });
      if (conv) {
        conversationIds.push(conv.id);
      } else {
        const created = await this.prisma.conversation.create({
          data: { contactId: link.contactId },
        });
        conversationIds.push(created.id);
      }
    }
    return conversationIds;
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const list = await this.prisma.broadcastList.findFirst({
      where: { id, organizationId },
    });
    if (!list) throw new NotFoundException('Lista no encontrada');
    await this.prisma.broadcastList.delete({ where: { id } });
  }

  async previewLists(
    organizationId: string,
    listIds: string[],
    userId?: string,
    userRole?: string,
  ): Promise<{
    total: number;
    unique: number;
    duplicates: number;
    invalid: number;
    blocked: number;
    conversationIds: string[];
  }> {
    if (!listIds?.length) {
      throw new BadRequestException('Selecciona al menos una lista CRM');
    }

    const lists = await this.prisma.broadcastList.findMany({
      where: {
        id: { in: listIds },
        organizationId,
        source: 'crm',
        ...(userRole === UserRole.AGENT && userId ? { assignedToUserId: userId } : {}),
      },
    });
    if (!lists.length) {
      throw new NotFoundException('No se encontraron listas CRM válidas');
    }

    const links = await this.prisma.broadcastListContact.findMany({
      where: { listId: { in: lists.map((l) => l.id) } },
      include: { contact: true },
    });

    const contactIds = links.map((l) => l.contactId);
    const uniqueContactIds = [...new Set(contactIds)];
    const duplicates = contactIds.length - uniqueContactIds.length;

    const windowMap = new Map<string, { canSend: boolean; isSandboxAuthorized: boolean }>();
    const conversations = await this.chat.getConversationsWithWindowStatus(organizationId, userId, userRole);
    for (const conv of conversations) {
      windowMap.set(conv.id, {
        canSend: conv.canSend,
        isSandboxAuthorized: conv.isSandboxAuthorized ?? false,
      });
    }

    const conversationIds: string[] = [];
    let invalid = 0;
    let blocked = 0;

    for (const contactId of uniqueContactIds) {
      const link = links.find((l) => l.contactId === contactId);
      const phone = link?.contact.phone || '';
      if (!phone || phone.replace(/\D/g, '').length < 7) {
        invalid += 1;
        continue;
      }

      let conv = await this.prisma.conversation.findFirst({ where: { contactId } });
      if (!conv) {
        conv = await this.prisma.conversation.create({ data: { contactId } });
      }

      const status = windowMap.get(conv.id);
      if (status && !status.canSend && !status.isSandboxAuthorized) {
        blocked += 1;
      }
      conversationIds.push(conv.id);
    }

    return {
      total: contactIds.length,
      unique: uniqueContactIds.length,
      duplicates,
      invalid,
      blocked,
      conversationIds,
    };
  }
}
