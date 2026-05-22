import type {
  CreatePlatformOrganizationBody,
  OrgOutboundAuditRow,
  PlatformAuditLogRow,
  PlatformOrganization,
  UserRole,
} from '@/shared/api/chatcontrol/client';

export interface PlatformRepository {
  getPlatformOrganizations(): Promise<PlatformOrganization[]>;
  createPlatformOrganization(body: CreatePlatformOrganizationBody): Promise<unknown>;
  bootstrapPlatformOrganizationFirstAdmin(
    organizationId: string,
    body: { email: string; password: string; displayName?: string },
  ): Promise<unknown>;
  setPlatformOrganizationStatus(id: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<unknown>;
  renamePlatformOrganization(id: string, name: string): Promise<unknown>;
  resetPlatformAdminPassword(organizationId: string, newPassword: string): Promise<unknown>;
  getPlatformAuditLogs(params?: { organizationId?: string; take?: number }): Promise<PlatformAuditLogRow[]>;
  getOrgAuditOutbound(take?: number): Promise<OrgOutboundAuditRow[]>;
  getOrgUsers(): Promise<Array<{ id: string; email: string; displayName: string | null; role: UserRole; createdAt: string }>>;
}
