import type { Conversation } from '@/entities/conversation';
import type { Message } from '@/entities/message';

export interface ChatRepository {
  getConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<{
    ok: boolean;
    conversation: Conversation | null;
    canSend: boolean;
    windowSecondsRemaining: number;
  }>;
  getMessages(conversationId: string, cursor?: string): Promise<{ messages: Message[]; nextCursor: string | null }>;
  getGallery(conversationId: string): Promise<Message[]>;
  searchMessages(conversationId: string, query: string): Promise<Message[]>;
  markConversationAsRead(conversationId: string): Promise<void>;
  sendMessage(conversationId: string, text: string): Promise<{ ok: boolean; message: Message }>;
  generateReply(conversationId: string): Promise<{ ok: boolean; text: string; usedFallbackModel?: boolean }>;
}
