export interface Contact {
  id: string;
  phone: string;
  name: string | null;
  isSandboxAuthorized: boolean;
  createdAt: number;
}
