import type { Contact } from '@/entities/contact';

export interface ContactsRepository {
  getContactsList(): Promise<Contact[]>;
  getContact(id: string): Promise<{ ok: boolean; contact: Contact | null }>;
  createContact(params: { phone: string; name?: string; isSandboxAuthorized?: boolean }): Promise<{ ok: boolean; contact: Contact }>;
  updateContact(id: string, params: { name?: string; isSandboxAuthorized?: boolean }): Promise<{ ok: boolean; contact: Contact }>;
}
