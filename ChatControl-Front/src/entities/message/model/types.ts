export interface Message {
  id: string;
  conversationId: string;
  fromUser: boolean;
  text: string;
  timestamp: number;
  fromAi?: boolean;
  type?: string;
  mediaUrl?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
}

export interface NewMessagePayload {
  conversationId: string;
  message: Message;
  companyId?: string;
}
