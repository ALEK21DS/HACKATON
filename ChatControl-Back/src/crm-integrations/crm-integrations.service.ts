import { Injectable, OnModuleInit, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SecretsCryptoService } from '../common/secrets-crypto.service';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export interface CrmConnectionDto {
  organizationId: string;
  codigoVinculacion: string;
  crmUrl: string;
  crmName: string;
  apiKey: string;
  isActive: boolean;
  createdAt: Date;
}

export interface SyncContactDto {
  externalId: string;
  name?: string;
  phone: string;
  email?: string;
  campaign?: string;
  seller?: string;
  source?: string;
}

export interface SyncResultDto {
  created: number;
  updated: number;
  rejected: number;
  errors: Array<{ externalId: string; error: string }>;
}

@Injectable()
export class CrmIntegrationsService implements OnModuleInit {
  private readonly hmacSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: SecretsCryptoService,
    private readonly config: ConfigService,
  ) {
    this.hmacSecret = this.config.get<string>('CRM_HMAC_SECRET', 'crm-integration-secret-change-me');
  }

  async onModuleInit() {
    try {
      const apiKey = this.config.get<string>('CRM_DEFAULT_API_KEY');
      if (!apiKey) return;

      const existing = await this.prisma.crmIntegration.findFirst({
        where: { isActive: true },
      });
      if (existing) return;

      const firstOrg = await this.prisma.organization.findFirst({
        where: { status: 'ACTIVE' },
      });
      if (!firstOrg) return;

      const code = this.generateCodigoVinculacion();
      const apiKeyHash = createHmac('sha256', this.hmacSecret).update(apiKey).digest('hex');
      const apiKeyEncrypted = this.crypto.encrypt(apiKey);

      await this.prisma.crmIntegration.create({
        data: {
          organizationId: firstOrg.id,
          codigoVinculacion: code,
          apiKeyHash,
          apiKeyEncrypted,
          isActive: true,
          crmName: 'CRM Ventas',
        },
      });
    } catch (err) {
      console.warn('[CrmIntegrations] No se pudo auto-crear integración (probablemente falta correr migración):', (err as Error).message);
    }
  }

  generateCodigoVinculacion(): string {
    const raw = randomBytes(4).toString('hex').toUpperCase();
    return `CRM-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  }

  verifyHmac(payload: string, signature: string): boolean {
    const expected = createHmac('sha256', this.hmacSecret).update(payload).digest('hex');
    try {
      const received = Buffer.from(signature, 'hex');
      const expectedBuf = Buffer.from(expected, 'hex');
      if (received.length !== expectedBuf.length) return false;
      return timingSafeEqual(received, expectedBuf);
    } catch {
      return false;
    }
  }

  async generateApiKey(organizationId: string, codigoVinculacion: string): Promise<{ apiKey: string; apiKeyEncrypted: string }> {
    const integration = await this.prisma.crmIntegration.findUnique({
      where: { codigoVinculacion },
    });
    if (!integration || integration.organizationId !== organizationId) {
      throw new NotFoundException('Código de vinculación inválido');
    }
    if (!integration.isActive) {
      throw new ForbiddenException('La integración está desactivada');
    }
    return this.createApiKey(integration.id);
  }

  async generateApiKeyByCode(codigoVinculacion: string): Promise<{ apiKey: string }> {
    const integration = await this.prisma.crmIntegration.findUnique({
      where: { codigoVinculacion },
    });
    if (!integration) {
      throw new NotFoundException('Código de vinculación inválido');
    }
    if (!integration.isActive) {
      throw new ForbiddenException('La integración está desactivada');
    }
    const result = await this.createApiKey(integration.id);
    return { apiKey: result.apiKey };
  }

  private async createApiKey(integrationId: string): Promise<{ apiKey: string; apiKeyEncrypted: string }> {
    const apiKey = randomBytes(32).toString('hex');
    const apiKeyHash = createHmac('sha256', this.hmacSecret).update(apiKey).digest('hex');
    const apiKeyEncrypted = this.crypto.encrypt(apiKey);
    await this.prisma.crmIntegration.update({
      where: { id: integrationId },
      data: { apiKeyHash, apiKeyEncrypted },
    });
    return { apiKey, apiKeyEncrypted };
  }

  async verifyApiKey(apiKey: string): Promise<{ organizationId: string; crmUrl: string | null } | null> {
    const integrations = await this.prisma.crmIntegration.findMany({
      where: { isActive: true },
    });
    for (const integration of integrations) {
      if (!integration.apiKeyHash) continue;
      const hash = createHmac('sha256', this.hmacSecret).update(apiKey).digest('hex');
      if (hash === integration.apiKeyHash) {
        return { organizationId: integration.organizationId, crmUrl: integration.crmUrl };
      }
    }
    return null;
  }

  async checkUser(
    email: string,
  ): Promise<{ exists: boolean; user?: { email: string; displayName: string; organizationName: string; role: string } }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      include: { organization: { select: { name: true, id: true } } },
    });
    if (!user) return { exists: false };
    return {
      exists: true,
      user: {
        email: user.email,
        displayName: user.displayName || user.email,
        organizationName: user.organization?.name || 'Sin organización',
        role: user.role,
      },
    };
  }

  async syncContacts(
    organizationId: string,
    assignedToUserId: string,
    listName: string,
    contacts: SyncContactDto[],
    crmUser?: string,
    crmName?: string,
  ): Promise<SyncResultDto & { listId: string }> {
    if (!contacts?.length) {
      throw new BadRequestException('No hay contactos para sincronizar');
    }

    const result: SyncResultDto = { created: 0, updated: 0, rejected: 0, errors: [] };

    // Obtener o crear la lista
    let list = await this.prisma.broadcastList.findUnique({
      where: { organizationId_name: { organizationId, name: listName } },
    });
    if (!list) {
      list = await this.prisma.broadcastList.create({
        data: {
          organizationId,
          name: listName,
          source: 'crm',
          crmExportedAt: new Date(),
          createdBy: crmUser,
          assignedToUserId,
        },
      });
    }

    for (const contact of contacts) {
      const phone = contact.phone.replace(/\D/g, '');
      if (!phone) {
        result.rejected++;
        result.errors.push({ externalId: contact.externalId, error: 'Teléfono inválido' });
        continue;
      }

      try {
        // Upsert contacto en la tabla Contact
        const dbContact = await this.prisma.contact.upsert({
          where: { organizationId_phone: { organizationId, phone } },
          create: {
            organizationId,
            phone,
            name: contact.name?.trim() || null,
          },
          update: {
            name: contact.name?.trim() || undefined,
          },
        });

        // Asegurar que existe una conversación
        const existingConv = await this.prisma.conversation.findFirst({
          where: { contactId: dbContact.id },
        });
        if (!existingConv) {
          await this.prisma.conversation.create({
            data: { contactId: dbContact.id },
          });
        }

        // Agregar a la lista (evitar duplicados en la misma lista)
        await this.prisma.broadcastListContact.upsert({
          where: { listId_contactId: { listId: list.id, contactId: dbContact.id } },
          create: {
            listId: list.id,
            contactId: dbContact.id,
            externalId: contact.externalId,
            campaign: contact.campaign,
            seller: contact.seller,
            source: contact.source || 'crm',
          },
          update: {
            externalId: contact.externalId,
            campaign: contact.campaign,
            seller: contact.seller,
          },
        });

        // Crear/actualizar vínculo de trazabilidad CRM → ChatControl
        await this.prisma.crmContactLink.upsert({
          where: { organizationId_crmLeadId: { organizationId, crmLeadId: contact.externalId || contact.phone } },
          create: {
            organizationId,
            crmLeadId: contact.externalId || contact.phone,
            chatcontrolContactId: dbContact.id,
            phone,
            listId: list.id,
            assignedToUserId,
            externalData: {
              campaign: contact.campaign,
              seller: contact.seller,
              source: contact.source || 'crm',
              name: contact.name,
              email: contact.email,
            },
          },
          update: {
            chatcontrolContactId: dbContact.id,
            phone,
            listId: list.id,
            assignedToUserId,
            externalData: {
              campaign: contact.campaign,
              seller: contact.seller,
              source: contact.source || 'crm',
              name: contact.name,
              email: contact.email,
            },
          },
        });

        const wasCreated = existingConv ? false : true;
        if (wasCreated) result.created++;
        else result.updated++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        result.rejected++;
        result.errors.push({ externalId: contact.externalId, error: msg });
      }
    }

    // Actualizar contador de la lista
    const count = await this.prisma.broadcastListContact.count({
      where: { listId: list.id },
    });
    await this.prisma.broadcastList.update({
      where: { id: list.id },
      data: { contactCount: count },
    });

    // Registrar auditoría
    await this.prisma.crmAuditLog.create({
      data: {
        organizationId,
        action: 'contacts_exported',
        crmUser,
        crmName,
        contactsTotal: contacts.length,
        contactsCreated: result.created,
        contactsUpdated: result.updated,
        contactsRejected: result.rejected,
        listName,
        details: {
          errors: result.errors,
          assignedToUserId,
          listId: list.id,
          contactsInList: count,
        },
      },
    });

    return { ...result, listId: list.id };
  }
}
