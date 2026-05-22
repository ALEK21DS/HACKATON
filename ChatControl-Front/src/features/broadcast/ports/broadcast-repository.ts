import type { BroadcastContact, BroadcastMessageType, BroadcastTemplate } from '@/shared/api/chatcontrol/client';

export interface BroadcastRepository {
  getBroadcastContacts(): Promise<BroadcastContact[]>;
  getBroadcastTemplates(): Promise<BroadcastTemplate[]>;
  generateBroadcastMessage(instruction: string): Promise<{ text: string; usedFallbackModel?: boolean }>;
  sendBroadcast(params: {
    conversationIds: string[];
    type: BroadcastMessageType;
    text?: string;
    templateId?: string;
    templateVariables?: Record<string, string>;
  }): Promise<{ sent: number; failed: number; errors: Array<{ conversationId: string; error: string }> }>;
}
