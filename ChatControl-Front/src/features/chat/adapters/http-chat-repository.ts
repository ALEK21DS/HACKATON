import {
  generateReply,
  getConversation,
  getConversations,
  getGallery,
  getMessages,
  markConversationAsRead,
  searchMessages,
  sendMessage,
} from '@/shared/api/chatcontrol/client';
import type { ChatRepository } from '../ports/chat-repository';

export const httpChatRepository: ChatRepository = {
  getConversations,
  getConversation,
  getMessages,
  getGallery,
  searchMessages,
  markConversationAsRead,
  sendMessage,
  generateReply,
};
