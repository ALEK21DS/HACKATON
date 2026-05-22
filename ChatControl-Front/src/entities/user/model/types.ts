export type UserRole = 'SUPER_ADMIN' | 'ORG_ADMIN' | 'AGENT';

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  organizationId: string | null;
  organizationName: string | null;
}
