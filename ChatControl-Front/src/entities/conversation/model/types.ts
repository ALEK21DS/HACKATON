export interface Conversation {
  id: string;
  phone: string;
  name?: string;
  isSandboxAuthorized?: boolean;
  lastUserMessageAt: number | null;
  lastMessagePreview: string;
  lastMessageAt: number;
  unreadCount?: number;
}
