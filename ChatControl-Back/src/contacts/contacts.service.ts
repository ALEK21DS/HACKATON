import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ContactDto {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  isSandboxAuthorized: boolean;
  createdAt: number;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) { }

  async findAll(organizationId: string, userId?: string, userRole?: string): Promise<ContactDto[]> {
    const where: any = { organizationId };
    if (userRole === 'AGENT' && userId) {
      where.conversations = {
        some: { assignedToUserId: userId }
      };
    }
    const list = await this.prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return list.map((c) => ({
      id: c.id,
      phone: c.phone,
      name: c.name,
      email: c.email,
      isSandboxAuthorized: c.isSandboxAuthorized,
      createdAt: c.createdAt.getTime(),
    }));
  }

  async createOrUpdate(
    organizationId: string,
    params: {
      phone: string;
      name?: string;
      email?: string;
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
        email: params.email?.trim() || null,
        isSandboxAuthorized: params.isSandboxAuthorized ?? false,
      },
      update: {
        name: params.name !== undefined ? params.name?.trim() || null : undefined,
        email: params.email !== undefined ? params.email?.trim() || null : undefined,
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
      email: contact.email,
      isSandboxAuthorized: contact.isSandboxAuthorized,
      createdAt: contact.createdAt.getTime(),
    };
  }

  async update(
    organizationId: string,
    id: string,
    params: { name?: string; email?: string; isSandboxAuthorized?: boolean },
  ): Promise<ContactDto> {
    const existing = await this.prisma.contact.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Contacto no encontrado');
    const contact = await this.prisma.contact.update({
      where: { id },
      data: {
        name: params.name !== undefined ? params.name?.trim() || null : undefined,
        email: params.email !== undefined ? params.email?.trim() || null : undefined,
        isSandboxAuthorized: params.isSandboxAuthorized ?? undefined,
      },
    });
    return {
      id: contact.id,
      phone: contact.phone,
      name: contact.name,
      email: contact.email,
      isSandboxAuthorized: contact.isSandboxAuthorized,
      createdAt: contact.createdAt.getTime(),
    };
  }

  async findOne(organizationId: string, id: string, userId?: string, userRole?: string): Promise<ContactDto | null> {
    const where: any = { id, organizationId };
    if (userRole === 'AGENT' && userId) {
      where.conversations = {
        some: { assignedToUserId: userId }
      };
    }
    const contact = await this.prisma.contact.findFirst({
      where,
    });
    if (!contact) return null;
    return {
      id: contact.id,
      phone: contact.phone,
      name: contact.name,
      email: contact.email,
      isSandboxAuthorized: contact.isSandboxAuthorized,
      createdAt: contact.createdAt.getTime(),
    };
  }

  async getExportGroupedByCampaign(
    organizationId: string,
    campaignIds: string[],
    contactIds: string[],
    userId?: string,
    userRole?: string,
  ): Promise<Array<{
    campaign: {
      id: string;
      name: string;
      description: string | null;
      isActive: boolean;
      createdAt: number;
    };
    contacts: Array<{
      contactId: string;
      campaign_name: string;
      form_name: string;
      email: string;
      name: string;
      phone: string;
      agent: string;
      assignedAt?: number;
    }>;
  }>> {
    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: campaignIds }, organizationId },
    });

    const ccRecords = await this.prisma.campaignContact.findMany({
      where: {
        campaignId: { in: campaignIds },
        contactId: { in: contactIds },
      },
    });

    const contactIdsInCampaigns = ccRecords.map(r => r.contactId);

    const where: any = { organizationId, id: { in: contactIdsInCampaigns } };
    if (userRole === 'AGENT' && userId) {
      where.conversations = { some: { assignedToUserId: userId } };
    }

    const contacts = await this.prisma.contact.findMany({
      where,
      include: {
        conversations: {
          where: userRole === 'AGENT' && userId
            ? { assignedToUserId: userId }
            : {},
          include: {
            assignedToUser: {
              select: { id: true, email: true, displayName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const contactMap = new Map(contacts.map(c => [c.id, c]));

    const result: Array<{
      campaign: any;
      contacts: any[];
    }> = [];

    const campaignGroup: Record<string, typeof ccRecords> = {};
    for (const r of ccRecords) {
      if (!campaignGroup[r.campaignId]) campaignGroup[r.campaignId] = [];
      campaignGroup[r.campaignId].push(r);
    }

    for (const campaign of campaigns) {
      const records = campaignGroup[campaign.id] || [];
      const campaignContacts: any[] = [];

      for (const r of records) {
        const c = contactMap.get(r.contactId);
        if (!c) continue;

        const conversation = c.conversations?.[0];
        const assignedUser = conversation?.assignedToUser;
        const agentName = assignedUser
          ? assignedUser.displayName || assignedUser.email
          : 'Sin asignar';

        campaignContacts.push({
          contactId: c.id,
          campaign_name: campaign.name,
          form_name: 'WSP KRAKE DEV',
          email: c.email ?? '',
          name: c.name ?? '',
          phone: c.phone,
          agent: agentName,
          assignedAt: r.createdAt.getTime(),
        });
      }

      result.push({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          isActive: campaign.isActive,
          createdAt: campaign.createdAt.getTime(),
        },
        contacts: campaignContacts,
      });
    }

    return result;
  }

  async getCampaignContacts(
    organizationId: string,
    campaignIds: string[],
  ): Promise<Record<string, string[]>> {
    const records = await this.prisma.campaignContact.findMany({
      where: {
        campaignId: { in: campaignIds },
        contact: { organizationId },
      },
      select: { campaignId: true, contactId: true },
    });

    const byCampaign: Record<string, string[]> = {};
    for (const r of records) {
      if (!byCampaign[r.campaignId]) byCampaign[r.campaignId] = [];
      byCampaign[r.campaignId].push(r.contactId);
    }
    return byCampaign;
  }

  async exportContacts(
    organizationId: string,
    contactIds: string[],
    userId?: string,
    userRole?: string,
  ): Promise<Array<{
    campaign_name: string;
    form_name: string;
    email: string;
    name: string;
    phone: string;
    agent: string;
  }>> {
    // Get the active campaign for this org
    const activeCampaign = await this.prisma.campaign.findFirst({
      where: { organizationId, isActive: true },
    });
    const campaignName = activeCampaign?.name ?? 'Sin campaña';

    // Build the where clause based on role
    const where: any = { organizationId, id: { in: contactIds } };
    if (userRole === 'AGENT' && userId) {
      where.conversations = {
        some: { assignedToUserId: userId },
      };
    }

    const contacts = await this.prisma.contact.findMany({
      where,
      include: {
        conversations: {
          where: userRole === 'AGENT' && userId
            ? { assignedToUserId: userId }
            : {},
          include: {
            assignedToUser: {
              select: { id: true, email: true, displayName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return contacts.map((c) => {
      const conversation = c.conversations[0];
      const assignedUser = conversation?.assignedToUser;
      const agentName = assignedUser
        ? assignedUser.displayName || assignedUser.email
        : 'Sin asignar';

      return {
        campaign_name: campaignName,
        form_name: 'WSP KRAKE DEV',
        email: c.email ?? '',
        name: c.name ?? '',
        phone: c.phone,
        agent: agentName,
      };
    });
  }
}
