import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecretsCryptoService } from '../common/secrets-crypto.service';

export interface IntegrationStatusDto {
  hasWhatsappToken: boolean;
  hasGeminiKey: boolean;
  whatsappPhoneNumberId: string | null;
}

export interface UpdateIntegrationsDto {
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  geminiApiKey?: string;
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
}
