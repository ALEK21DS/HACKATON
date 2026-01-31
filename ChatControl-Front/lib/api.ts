/**
 * Cliente API para el backend ChatControl.
 * Tokens NUNCA se exponen aquí; el JWT se envía en Authorization.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('chatcontrol_token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error?.message || res.statusText);
  return data as T;
}

// Auth
export async function login(phone: string, password: string) {
  const data = await api<{ access_token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });
  if (typeof window !== 'undefined') localStorage.setItem('chatcontrol_token', data.access_token);
  return data;
}

export function logout() {
  if (typeof window !== 'undefined') localStorage.removeItem('chatcontrol_token');
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// Chat
export interface Conversation {
  id: string;
  phone: string;
  /** Nombre del contacto (opcional; si el backend lo añade, la búsqueda lo usará) */
  name?: string;
  lastUserMessageAt: number | null;
  lastMessagePreview: string;
  lastMessageAt: number;
}

export interface Message {
  id: string;
  conversationId: string;
  fromUser: boolean;
  text: string;
  timestamp: number;
  fromAi?: boolean;
}

/** Payload del evento WebSocket new_message (emitido por el backend al guardar un mensaje) */
export interface NewMessagePayload {
  conversationId: string;
  message: Message;
  companyId?: string;
}

export async function getConversations(): Promise<Conversation[]> {
  return api<Conversation[]>('/chat/conversations');
}

export async function getConversation(id: string): Promise<{
  ok: boolean;
  conversation: Conversation | null;
  canSend: boolean;
  windowSecondsRemaining: number;
}> {
  return api(`/chat/conversations/${id}`);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return api<Message[]>(`/chat/conversations/${conversationId}/messages`);
}

export async function canSend(conversationId: string): Promise<{
  canSend: boolean;
  windowSecondsRemaining: number;
}> {
  return api(`/chat/conversations/${conversationId}/can-send`);
}

export async function sendMessage(
  conversationId: string,
  text: string,
): Promise<{ ok: boolean; message: Message }> {
  return api(`/chat/conversations/${conversationId}/send`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function generateReply(
  conversationId: string,
): Promise<{ ok: boolean; text: string }> {
  return api(`/chat/conversations/${conversationId}/generate-reply`, {
    method: 'POST',
  });
}

// Broadcast (Mensajes Masivos)
export interface BroadcastContact {
  id: string;
  phone: string;
  name?: string;
  canSend: boolean;
  windowSecondsRemaining: number;
  lastMessagePreview: string;
  lastMessageAt: number;
}

export interface BroadcastTemplate {
  id: string;
  name: string;
  body: string;
  variables: string[];
}

export type BroadcastMessageType = 'manual' | 'template' | 'ia';

export async function getBroadcastContacts(): Promise<BroadcastContact[]> {
  return api<BroadcastContact[]>('/broadcast/contacts');
}

export async function getBroadcastTemplates(): Promise<BroadcastTemplate[]> {
  return api<BroadcastTemplate[]>('/broadcast/templates');
}

export async function generateBroadcastMessage(instruction: string): Promise<{ text: string }> {
  return api<{ text: string }>('/broadcast/generate-message', {
    method: 'POST',
    body: JSON.stringify({ instruction }),
  });
}

export async function sendBroadcast(params: {
  conversationIds: string[];
  type: BroadcastMessageType;
  text?: string;
  templateId?: string;
  templateVariables?: Record<string, string>;
}): Promise<{ sent: number; failed: number; errors: Array<{ conversationId: string; error: string }> }> {
  return api('/broadcast/send', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}
