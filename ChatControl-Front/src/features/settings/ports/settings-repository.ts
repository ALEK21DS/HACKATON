import type { IntegrationStatus, SettingsData, WhatsappTier } from '@/shared/api/chatcontrol/client';

export interface SettingsRepository {
  getSettings(): Promise<SettingsData>;
  updateSettings(body: { whatsappTier?: WhatsappTier; geminiModel?: string }): Promise<SettingsData>;
  getIntegrationStatus(): Promise<IntegrationStatus>;
  updateIntegrations(body: {
    whatsappAccessToken?: string;
    whatsappPhoneNumberId?: string;
    whatsappBusinessAccountId?: string;
    geminiApiKey?: string;
  }): Promise<IntegrationStatus>;
}
