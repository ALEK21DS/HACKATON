import {
  bootstrapPlatformOrganizationFirstAdmin,
  createPlatformOrganization,
  getOrgAuditOutbound,
  getOrgUsers,
  getPlatformAuditLogs,
  getPlatformOrganizations,
  renamePlatformOrganization,
  resetPlatformAdminPassword,
  setPlatformOrganizationStatus,
} from '@/shared/api/chatcontrol/client';
import type { PlatformRepository } from '../ports/platform-repository';

export const httpPlatformRepository: PlatformRepository = {
  getPlatformOrganizations,
  createPlatformOrganization,
  bootstrapPlatformOrganizationFirstAdmin,
  setPlatformOrganizationStatus,
  renamePlatformOrganization,
  resetPlatformAdminPassword,
  getPlatformAuditLogs,
  getOrgAuditOutbound,
  getOrgUsers,
};
