import type { BroadcastContactsPage, BroadcastMessageType, BroadcastTemplate } from '@/shared/api/chatcontrol/client';

export interface BroadcastRepository {
  getBroadcastContacts(params?: { cursor?: string; limit?: number; q?: string }): Promise<BroadcastContactsPage>;
  getBroadcastTemplates(): Promise<BroadcastTemplate[]>;
  generateBroadcastMessage(instruction: string): Promise<{ text: string; usedFallbackModel?: boolean }>;
  sendBroadcast(params: {
    conversationIds: string[];
    type: BroadcastMessageType;
    text?: string;
    templateId?: string;
    templateVariables?: Record<string, string>;
    templateAutoNameVariables?: string[];
    templateHeaderValue?: string;
    templateButtonVariables?: Record<string, string>;
  }): Promise<{ started: true; total: number }>;
}
