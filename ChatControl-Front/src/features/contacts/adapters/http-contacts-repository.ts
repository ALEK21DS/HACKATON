import {
  createContact,
  getContact,
  getContactsList,
  updateContact,
} from '@/shared/api/chatcontrol/client';
import type { ContactsRepository } from '../ports/contacts-repository';

export const httpContactsRepository: ContactsRepository = {
  getContactsList,
  getContact,
  createContact,
  updateContact,
};
