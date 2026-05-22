import {
  generateBroadcastMessage,
  getBroadcastContacts,
  getBroadcastTemplates,
  sendBroadcast,
} from '@/shared/api/chatcontrol/client';
import type { BroadcastRepository } from '../ports/broadcast-repository';

export const httpBroadcastRepository: BroadcastRepository = {
  getBroadcastContacts,
  getBroadcastTemplates,
  generateBroadcastMessage,
  sendBroadcast,
};
