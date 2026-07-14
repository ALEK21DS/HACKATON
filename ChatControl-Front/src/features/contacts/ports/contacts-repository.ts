import type { Contact } from '@/entities/contact';

export interface ContactsRepository {
  getContactsList(params?: { cursor?: string; limit?: number; q?: string; campaignIds?: string[] }): Promise<{ contacts: Contact[]; nextCursor: string | null; total: number }>;
  getContact(id: string): Promise<{ ok: boolean; contact: Contact | null }>;
  createContact(params: { phone: string; name?: string; isSandboxAuthorized?: boolean }): Promise<{ ok: boolean; contact: Contact }>;
  updateContact(id: string, params: { name?: string; isSandboxAuthorized?: boolean }): Promise<{ ok: boolean; contact: Contact }>;
}
