import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecretsCryptoService } from '../common/secrets-crypto.service';

export interface IntegrationStatusDto {
  hasWhatsappToken: boolean;
  hasGeminiKey: boolean;
  whatsappPhoneNumberId: string | null;
  hasWhatsappBusinessAccountId: boolean;
}

export interface UpdateIntegrationsDto {
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  geminiApiKey?: string;
}

export interface LeadDetectionConfigDto {
  enabled: boolean;
  autoMessage: string;
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: SecretsCryptoService,
  ) {}

  async getStatus(organizationId: string): Promise<IntegrationStatusDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { credentials: true },
    });
    if (!org) throw new NotFoundException('Empresa no encontrada');
    const c = org.credentials;
    return {
      hasWhatsappToken: !!(c?.whatsappAccessTokenEnc && c.whatsappAccessTokenEnc.length > 0),
      hasGeminiKey: !!(c?.geminiApiKeyEnc && c.geminiApiKeyEnc.length > 0),
      whatsappPhoneNumberId: org.whatsappPhoneNumberId,
      hasWhatsappBusinessAccountId: !!(c?.whatsappBusinessAccountIdEnc && c.whatsappBusinessAccountIdEnc.length > 0),
    };
  }

  async update(organizationId: string, dto: UpdateIntegrationsDto): Promise<IntegrationStatusDto> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Empresa no encontrada');

    const dataOrg: { whatsappPhoneNumberId?: string | null } = {};
    if (dto.whatsappPhoneNumberId !== undefined) {
      dataOrg.whatsappPhoneNumberId = dto.whatsappPhoneNumberId.trim() || null;
    }
    if (Object.keys(dataOrg).length) {
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: dataOrg,
      });
    }

    const credUpsert: {
      whatsappAccessTokenEnc?: string;
      whatsappBusinessAccountIdEnc?: string;
      geminiApiKeyEnc?: string;
    } = {};

    if (dto.whatsappAccessToken !== undefined && dto.whatsappAccessToken.trim()) {
      credUpsert.whatsappAccessTokenEnc = this.crypto.encrypt(dto.whatsappAccessToken.trim());
    }
    if (dto.whatsappBusinessAccountId !== undefined && dto.whatsappBusinessAccountId.trim()) {
      credUpsert.whatsappBusinessAccountIdEnc = this.crypto.encrypt(
        dto.whatsappBusinessAccountId.trim(),
      );
    }
    if (dto.geminiApiKey !== undefined && dto.geminiApiKey.trim()) {
      credUpsert.geminiApiKeyEnc = this.crypto.encrypt(dto.geminiApiKey.trim());
    }

    if (Object.keys(credUpsert).length) {
      await this.prisma.organizationCredentials.upsert({
        where: { organizationId },
        create: {
          organizationId,
          ...credUpsert,
        },
        update: credUpsert,
      });
    }

    return this.getStatus(organizationId);
  }

  private async getSetting(organizationId: string, key: string): Promise<string | null> {
    const row = await this.prisma.organizationSetting.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });
    return row?.value ?? null;
  }

  private async setSetting(organizationId: string, key: string, value: string): Promise<void> {
    await this.prisma.organizationSetting.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: { organizationId, key, value },
      update: { value },
    });
  }

  async getLeadDetectionConfig(organizationId: string): Promise<LeadDetectionConfigDto> {
    const enabled = await this.getSetting(organizationId, 'lead_detection_enabled');
    const autoMessage = await this.getSetting(organizationId, 'lead_detection_message');
    return {
      enabled: enabled === 'true',
      autoMessage: autoMessage ?? '',
    };
  }

  async updateLeadDetectionConfig(
    organizationId: string,
    config: LeadDetectionConfigDto,
  ): Promise<LeadDetectionConfigDto> {
    await this.setSetting(organizationId, 'lead_detection_enabled', config.enabled ? 'true' : 'false');
    await this.setSetting(organizationId, 'lead_detection_message', config.autoMessage);
    return config;
  }
}
