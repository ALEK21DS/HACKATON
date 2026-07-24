/**
 * Cliente API para el backend ChatControl.
 * Tokens NUNCA se exponen aquí; el JWT se envía en Authorization.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('chatcontrol_token');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('chatcontrol_refresh_token');
}

function setTokens(access: string, refresh?: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('chatcontrol_token', access);
  if (refresh) localStorage.setItem('chatcontrol_refresh_token', refresh);
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
  
  let res = await fetch(`${BASE}${path}`, { ...options, headers });
  
  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      const refreshRes = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (refreshRes.ok) {
        const refData = await refreshRes.json();
        setTokens(refData.access_token, refData.refresh_token);
        (headers as Record<string, string>)['Authorization'] = `Bearer ${refData.access_token}`;
        // Retry the original request
        res = await fetch(`${BASE}${path}`, { ...options, headers });
      } else {
        logout();
      }
    } else {
      logout();
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error?.message || res.statusText);
  return data as T;
}

export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'AGENT';

export interface MeResponse {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  organizationId: string | null;
  organizationName: string | null;
  isSandbox?: boolean;
}

// Auth: email + contraseña (usuarios en BD)
export async function login(email: string, password: string) {
  const data = await api<{ access_token: string; refresh_token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

/** Compatibilidad MVP: teléfono + APP_LOGIN_PASSWORD (usuario seed legacy) */
export async function loginLegacy(phone: string, password: string) {
  const data = await api<{ access_token: string; refresh_token?: string }>('/auth/login-legacy', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function getMe(): Promise<MeResponse> {
  return api<MeResponse>('/auth/me');
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('chatcontrol_token');
    localStorage.removeItem('chatcontrol_refresh_token');
    window.location.href = '/login'; // Redirect to login on logout
  }
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// Chat
export interface Conversation {
  id: string;
  phone: string;
  name?: string;
  email?: string | null;
  contactId?: string;
  /** Solo pruebas: número autorizado en Meta (sandbox). Si false, no se puede enviar en modo sandbox. */
  isSandboxAuthorized?: boolean;
  lastUserMessageAt: number | null;
  lastMessagePreview: string;
  lastMessageAt: number;
  /** Número de mensajes entrantes no leídos. */
  unreadCount?: number;
  assignedToUserId?: string | null;
  isNewLead?: boolean;
}

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
  status?: string;
}

/** Payload del evento WebSocket new_message (emitido por el backend al guardar un mensaje) */
export interface NewMessagePayload {
  conversationId: string;
  message: Message;
  companyId?: string;
}

export interface MessageStatusPayload {
  conversationId: string;
  messageId: string;
  status: string;
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

export async function getMessages(conversationId: string, cursor?: string): Promise<{messages: Message[], nextCursor: string | null}> {
  const q = cursor ? `?cursor=${cursor}` : '';
  return api<{messages: Message[], nextCursor: string | null}>(`/chat/conversations/${conversationId}/messages${q}`);
}

export async function getGallery(conversationId: string, cursor?: string): Promise<{ items: Message[]; nextCursor: string | null }> {
  const q = cursor ? `?cursor=${cursor}` : '';
  return api<{ items: Message[]; nextCursor: string | null }>(`/chat/conversations/${conversationId}/gallery${q}`);
}

export async function searchMessages(conversationId: string, query: string): Promise<Message[]> {
  return api<Message[]>(`/chat/conversations/${conversationId}/search?q=${encodeURIComponent(query)}`);
}

export async function markConversationAsRead(conversationId: string): Promise<void> {
  await api<{ ok: boolean }>(`/chat/conversations/${conversationId}/read`, { method: 'PATCH' });
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

export async function assignConversation(
  conversationId: string,
  assignToUserId: string | null,
): Promise<{ ok: boolean }> {
  return api(`/chat/conversations/${conversationId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ assignToUserId }),
  });
}

export async function backfillAssignments(): Promise<{ assigned: number; total: number }> {
  return api('/chat/conversations/backfill-assignment', { method: 'POST' });
}

export async function getNextAgent(): Promise<{ id: string; displayName: string | null; email: string } | null> {
  return api('/chat/lead-assignment/next-agent');
}

export async function sendMedia(
  conversationId: string,
  file: File,
): Promise<{ ok: boolean; message: Message }> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/chat/conversations/${conversationId}/send-media`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Error al enviar archivo' }));
    throw new Error(err.message || err.error?.message || 'Error al enviar archivo');
  }
  return res.json();
}

export async function generateReply(
  conversationId: string,
): Promise<{ ok: boolean; text: string; usedFallbackModel?: boolean }> {
  return api(`/chat/conversations/${conversationId}/generate-reply`, {
    method: 'POST',
  });
}

// Broadcast (Mensajes Masivos)
export interface BroadcastContact {
  id: string;
  contactId: string;
  phone: string;
  name?: string;
  canSend: boolean;
  windowSecondsRemaining: number;
  lastMessagePreview: string;
  lastMessageAt: number;
  isSandboxAuthorized: boolean;
}

export interface BroadcastTemplate {
  id: string;
  name: string;
  body: string;
  variables: string[];
}

export type BroadcastMessageType = 'manual' | 'template' | 'ia';

export interface BroadcastContactsPage {
  contacts: BroadcastContact[];
  nextCursor: string | null;
  total: number;
}

export async function getBroadcastContacts(params?: { cursor?: string; limit?: number; q?: string; campaignIds?: string[] }): Promise<BroadcastContactsPage> {
  const qs = new URLSearchParams();
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.q?.trim()) qs.set('q', params.q.trim());
  if (params?.campaignIds?.length) qs.set('campaignIds', params.campaignIds.join(','));
  const query = qs.toString();
  return api<BroadcastContactsPage>(`/broadcast/contacts${query ? `?${query}` : ''}`);
}

export async function getBroadcastContactIds(params?: { q?: string; onlyCanSend?: boolean; campaignIds?: string[] }): Promise<string[]> {
  const qs = new URLSearchParams();
  if (params?.q?.trim()) qs.set('q', params.q.trim());
  if (params?.onlyCanSend) qs.set('onlyCanSend', 'true');
  if (params?.campaignIds?.length) qs.set('campaignIds', params.campaignIds.join(','));
  const query = qs.toString();
  const res = await api<{ ids: string[] }>(`/broadcast/contacts/ids${query ? `?${query}` : ''}`);
  return res.ids;
}

export async function getBroadcastCampaignContactMap(
  campaignIds: string[],
): Promise<{ ok: boolean; byCampaign: Record<string, string[]> }> {
  return api('/broadcast/campaign-contacts', {
    method: 'POST',
    body: JSON.stringify({ campaignIds }),
  });
}

export async function getBroadcastTemplates(): Promise<BroadcastTemplate[]> {
  return api<BroadcastTemplate[]>('/broadcast/templates');
}

export async function generateBroadcastMessage(instruction: string): Promise<{ text: string; usedFallbackModel?: boolean }> {
  return api<{ text: string; usedFallbackModel?: boolean }>('/broadcast/generate-message', {
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

// Contactos (sandbox: autorización manual en Meta)
export interface ContactItem {
  id: string;
  phone: string;
  name: string | null;
  email?: string | null;
  isSandboxAuthorized: boolean;
  createdAt: number;
}

export interface ContactsPage {
  contacts: ContactItem[];
  nextCursor: string | null;
  total: number;
}

export async function getContactsList(params?: { cursor?: string; limit?: number; q?: string; campaignIds?: string[] }): Promise<ContactsPage> {
  const qs = new URLSearchParams();
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.q?.trim()) qs.set('q', params.q.trim());
  if (params?.campaignIds?.length) qs.set('campaignIds', params.campaignIds.join(','));
  const query = qs.toString();
  return api<ContactsPage>(`/contacts${query ? `?${query}` : ''}`);
}

export async function getContactIds(params?: { q?: string; campaignIds?: string[] }): Promise<string[]> {
  const qs = new URLSearchParams();
  if (params?.q?.trim()) qs.set('q', params.q.trim());
  if (params?.campaignIds?.length) qs.set('campaignIds', params.campaignIds.join(','));
  const query = qs.toString();
  const res = await api<{ ids: string[] }>(`/contacts/ids${query ? `?${query}` : ''}`);
  return res.ids;
}

export async function getContact(id: string): Promise<{ ok: boolean; contact: ContactItem | null }> {
  return api(`/contacts/${id}`);
}

export async function createContact(params: {
  phone: string;
  name?: string;
  email?: string;
  isSandboxAuthorized?: boolean;
}): Promise<{ ok: boolean; contact: ContactItem }> {
  return api('/contacts', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateContact(
  id: string,
  params: { name?: string; email?: string; isSandboxAuthorized?: boolean },
): Promise<{ ok: boolean; contact: ContactItem }> {
  return api(`/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

// Plantillas (para Mensajes masivos > Plantilla aprobada)
export interface TemplateItem {
  id: string;
  name: string;
  body: string;
  variables: string[];
  createdAt?: number;
  updatedAt?: number;
  language?: string;
}

/** Plantillas aprobadas de la cuenta WhatsApp Business (Meta). Mismo formato que TemplateItem. */
export async function getTemplatesFromMeta(): Promise<TemplateItem[]> {
  return api<TemplateItem[]>('/templates/from-meta');
}

export async function getTemplatesList(): Promise<TemplateItem[]> {
  return api<TemplateItem[]>('/templates');
}

export async function getTemplate(id: string): Promise<{ ok: boolean; template: TemplateItem | null }> {
  return api(`/templates/${id}`);
}

export async function createTemplate(params: { name: string; body: string }): Promise<{ ok: boolean; template: TemplateItem }> {
  return api('/templates', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updateTemplate(
  id: string,
  params: { name?: string; body?: string },
): Promise<{ ok: boolean; template: TemplateItem }> {
  return api(`/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export async function deleteTemplate(id: string): Promise<{ ok: boolean }> {
  return api(`/templates/${id}`, { method: 'DELETE' });
}

// Configuración (tier WhatsApp + modelo Gemini)
export type WhatsappTier = 'new' | 'level1' | 'level2' | 'level3' | 'excellent';

export interface SettingsData {
  whatsappTier: WhatsappTier;
  dailyLimit: number | null; // null = ilimitado
  geminiModel: string;
  geminiModelInUse: string;
}

export async function getSettings(): Promise<SettingsData> {
  return api<SettingsData>('/settings');
}

export async function updateSettings(body: {
  whatsappTier?: WhatsappTier;
  geminiModel?: string;
}): Promise<SettingsData> {
  return api<SettingsData>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function syncWhatsappLimit(): Promise<{ whatsappTier: WhatsappTier; dailyLimit: number | null }> {
  return api<{ whatsappTier: WhatsappTier; dailyLimit: number | null }>('/whatsapp/sync-limit', {
    method: 'POST',
  });
}

// Plataforma (super admin)
export interface PlatformOrganization {
  id: string;
  name: string;
  status: string;
  whatsappPhoneNumberId: string | null;
  createdAt: string;
  _count: { users: number; contacts: number };
}

export async function getPlatformOrganizations(): Promise<PlatformOrganization[]> {
  return api<PlatformOrganization[]>('/platform/organizations');
}

export interface CreatePlatformOrganizationBody {
  name: string;
  adminEmail?: string;
  adminPassword?: string;
  adminDisplayName?: string;
}

export async function createPlatformOrganization(
  body: CreatePlatformOrganizationBody,
): Promise<{
  id: string;
  name: string;
  status: string;
  createdAt: string;
  firstAdmin?: { id: string; email: string; displayName: string | null; role: string };
}> {
  return api('/platform/organizations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function bootstrapPlatformOrganizationFirstAdmin(
  organizationId: string,
  body: { email: string; password: string; displayName?: string },
): Promise<{ id: string; email: string; displayName: string | null; role: string }> {
  return api(`/platform/organizations/${organizationId}/first-admin`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function setPlatformOrganizationStatus(
  id: string,
  status: 'ACTIVE' | 'SUSPENDED',
): Promise<{ id: string; name: string; status: string }> {
  return api(`/platform/organizations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function renamePlatformOrganization(
  id: string,
  name: string,
): Promise<{ id: string; name: string; status: string }> {
  return api(`/platform/organizations/${id}/rename`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function resetPlatformAdminPassword(
  organizationId: string,
  newPassword: string,
): Promise<{ success: boolean; adminEmail: string }> {
  return api(`/platform/organizations/${organizationId}/reset-admin-password`, {
    method: 'PATCH',
    body: JSON.stringify({ newPassword }),
  });
}

export interface PlatformAuditLogRow {
  id: string;
  action: string;
  targetOrganizationId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; email: string; displayName: string | null };
}

export async function getPlatformAuditLogs(params?: {
  organizationId?: string;
  take?: number;
}): Promise<PlatformAuditLogRow[]> {
  const q = new URLSearchParams();
  if (params?.organizationId) q.set('organizationId', params.organizationId);
  if (params?.take != null) q.set('take', String(params.take));
  const suffix = q.toString() ? `?${q}` : '';
  return api<PlatformAuditLogRow[]>(`/platform/audit-logs${suffix}`);
}

export interface OrgOutboundAuditRow {
  id: string;
  conversationId: string;
  contactPhone: string;
  contactName: string | null;
  bodyPreview: string;
  fromAi: boolean;
  whatsappTimestamp: number;
  sentBy: { id: string; email: string; displayName: string | null } | null;
}

export interface LeadAssignmentAgents {
  agentIds: string[];
}

export async function getLeadAssignmentEnabled(): Promise<{ enabled: boolean }> {
  return api<{ enabled: boolean }>('/org/integrations/lead-assignment-enabled');
}

export async function updateLeadAssignmentEnabled(enabled: boolean): Promise<{ enabled: boolean }> {
  return api<{ enabled: boolean }>('/org/integrations/lead-assignment-enabled', {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

export async function getLeadAssignmentAgents(): Promise<LeadAssignmentAgents> {
  return api<LeadAssignmentAgents>('/org/integrations/lead-assignment');
}

export async function updateLeadAssignmentAgents(agentIds: string[]): Promise<LeadAssignmentAgents> {
  return api<LeadAssignmentAgents>('/org/integrations/lead-assignment', {
    method: 'PATCH',
    body: JSON.stringify({ agentIds }),
  });
}

export async function getOrgAuditOutbound(take?: number): Promise<OrgOutboundAuditRow[]> {
  const q = take != null ? `?take=${take}` : '';
  return api<OrgOutboundAuditRow[]>(`/org/audit/outbound${q}`);
}

// Integraciones (ORG_ADMIN)
export interface IntegrationStatus {
  hasWhatsappToken: boolean;
  hasGeminiKey: boolean;
  whatsappPhoneNumberId: string | null;
  hasWhatsappBusinessAccountId: boolean;
}

export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  return api<IntegrationStatus>('/org/integrations');
}

export async function updateIntegrations(body: {
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  geminiApiKey?: string;
}): Promise<IntegrationStatus> {
  return api<IntegrationStatus>('/org/integrations', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function getOrgUsers(params?: { assignable?: boolean }): Promise<
  Array<{ id: string; email: string; displayName: string | null; role: UserRole; isActive: boolean; createdAt: string }>
> {
  const query = params?.assignable ? '?assignable=true' : '';
  return api('/org/users' + query);
}

export async function createOrgUser(body: {
  email: string;
  password: string;
  displayName?: string;
  role: 'ORG_ADMIN' | 'AGENT';
}): Promise<{ id: string; email: string }> {
  return api('/org/users', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateOrgUser(
  id: string,
  body: { displayName?: string; role?: UserRole },
): Promise<{ id: string; email: string }> {
  return api(`/org/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function resetOrgUserPassword(
  id: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  return api(`/org/users/${id}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ newPassword }),
  });
}

export async function deactivateOrgUser(id: string): Promise<{ deactivatedUser: string; reassigned: number }> {
  return api(`/org/users/${id}/deactivate`, { method: 'PATCH' });
}

export async function reactivateOrgUser(id: string): Promise<{ reactivatedUser: string }> {
  return api(`/org/users/${id}/reactivate`, { method: 'PATCH' });
}

export interface AssignmentLogEntry {
  id: string;
  conversationId: string;
  fromUserId: string | null;
  toUserId: string | null;
  reassignedByUserId: string;
  reason: string;
  createdAt: string;
}

export async function getAssignmentAuditLogs(): Promise<AssignmentLogEntry[]> {
  return api<AssignmentLogEntry[]>('/broadcast/audit/assignments');
}

export interface BroadcastLogEntry {
  id: string;
  conversationId: string;
  type: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  organizationId: string | null;
  userId: string | null;
}

export async function getBroadcastAuditLogs(): Promise<BroadcastLogEntry[]> {
  return api<BroadcastLogEntry[]>('/broadcast/audit/broadcast');
}

export async function sendMediaFile(
  conversationId: string,
  file: File,
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT',
): Promise<{ ok: boolean; message: Message }> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/chat/conversations/${conversationId}/send-media?type=${type}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || res.statusText);
  return data;
}

// ── CRM Integration (ORG_ADMIN) ──

export interface CrmIntegrationStatus {
  connected: boolean;
  codigoVinculacion: string | null;
  crmUrl: string | null;
  crmName: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function getCrmCode(): Promise<{
  codigoVinculacion: string;
  isActive: boolean;
  crmUrl: string | null;
  crmName: string | null;
  createdAt: string;
  newCode?: boolean;
}> {
  return api('/crm-integrations/code');
}

export async function regenerateCrmCode(): Promise<{
  codigoVinculacion: string;
  isActive: boolean;
}> {
  return api('/crm-integrations/code/regenerate', { method: 'POST' });
}

export async function getCrmStatus(): Promise<CrmIntegrationStatus> {
  return api('/crm-integrations/status');
}

export async function getCrmAuditLogs(): Promise<{
  logs: Array<{
    id: string;
    action: string;
    crmUser: string | null;
    crmName: string | null;
    contactsTotal: number;
    contactsCreated: number;
    contactsUpdated: number;
    contactsRejected: number;
    listName: string | null;
    createdAt: string;
  }>;
}> {
  return api('/crm-integrations/audit');
}

// ── Broadcast Lists ──

export interface BroadcastListItem {
  id: string;
  name: string;
  source: string | null;
  contactCount: number;
  crmExportedAt: string | null;
  createdAt: string;
}

export interface BroadcastListContact {
  id: string;
  phone: string;
  name: string | null;
  externalId: string | null;
  campaign: string | null;
  seller: string | null;
}

export async function getBroadcastLists(): Promise<BroadcastListItem[]> {
  return api<BroadcastListItem[]>('/broadcast-lists');
}

export async function getCrmBroadcastLists(): Promise<BroadcastListItem[]> {
  return api<BroadcastListItem[]>('/broadcast-lists/crm');
}

export interface BroadcastListPreview {
  total: number;
  unique: number;
  duplicates: number;
  invalid: number;
  blocked: number;
  conversationIds: string[];
}

export async function previewBroadcastLists(listIds: string[]): Promise<BroadcastListPreview> {
  return api<BroadcastListPreview>('/broadcast-lists/preview', {
    method: 'POST',
    body: JSON.stringify({ listIds }),
  });
}

export interface ImportExcelContactsResult {
  listId: string;
  created: number;
  updated: number;
  rejected: number;
  errors: Array<{ phone?: string; error: string }>;
  newContactIds: string[];
  conversationIds: string[];
  outOfWindowCount: number;
}

export async function importExcelContacts(
  contacts: Array<{ name?: string; phone: string }>,
  listName?: string,
): Promise<ImportExcelContactsResult> {
  return api<ImportExcelContactsResult>('/broadcast-lists/import-excel', {
    method: 'POST',
    body: JSON.stringify({ contacts, listName }),
  });
}

export async function getBroadcastListDetail(id: string): Promise<{
  list: BroadcastListItem;
  contacts: BroadcastListContact[];
}> {
  return api(`/broadcast-lists/${id}`);
}

export async function getBroadcastListContactIds(id: string): Promise<{
  ok: boolean;
  contactIds: string[];
  conversationIds: string[];
  count: number;
}> {
  return api(`/broadcast-lists/${id}/contacts`);
}

export async function deleteBroadcastList(id: string): Promise<{ ok: boolean }> {
  return api(`/broadcast-lists/${id}`, { method: 'DELETE' });
}

export interface Campaign {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: number | string;
  updatedAt: number | string;
}

export async function getCampaigns(): Promise<Campaign[]> {
  return api<Campaign[]>('/campaigns');
}

export async function createCampaign(body: { name: string; description?: string }): Promise<Campaign> {
  return api<Campaign>('/campaigns', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function activateCampaign(id: string): Promise<Campaign> {
  return api<Campaign>(`/campaigns/${id}/activate`, {
    method: 'PATCH',
  });
}

export async function deleteCampaign(id: string): Promise<void> {
  await api(`/campaigns/${id}`, {
    method: 'DELETE',
  });
}

export interface ExportContactRow {
  campaign_name: string;
  form_name: string;
  email: string;
  name: string;
  phone: string;
  agent: string;
}

export interface ExportCampaignInfo {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: number;
}

export interface ExportCampaignContactRow extends ExportContactRow {
  contactId: string;
  assignedAt?: number;
}

export interface ExportCampaignGroup {
  campaign: ExportCampaignInfo;
  contacts: ExportCampaignContactRow[];
}

export async function exportContacts(
  contactIds: string[],
  campaignIds?: string[],
): Promise<{ ok: boolean; rows: ExportContactRow[]; byCampaign?: ExportCampaignGroup[] }> {
  return api('/contacts/export', {
    method: 'POST',
    body: JSON.stringify({ contactIds, campaignIds }),
  });
}

export async function getCampaignContactMap(
  campaignIds: string[],
): Promise<{ ok: boolean; byCampaign: Record<string, string[]> }> {
  return api('/contacts/campaign-contacts', {
    method: 'POST',
    body: JSON.stringify({ campaignIds }),
  });
}

