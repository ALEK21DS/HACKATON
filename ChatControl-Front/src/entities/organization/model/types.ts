export interface Organization {
  id: string;
  name: string;
  status: string;
  whatsappPhoneNumberId: string | null;
  createdAt: string;
  _count: { users: number; contacts: number };
}
