import {
  getIntegrationStatus,
  getSettings,
  updateIntegrations,
  updateSettings,
} from '@/shared/api/chatcontrol/client';
import type { SettingsRepository } from '../ports/settings-repository';

export const httpSettingsRepository: SettingsRepository = {
  getSettings,
  updateSettings,
  getIntegrationStatus,
  updateIntegrations,
};
