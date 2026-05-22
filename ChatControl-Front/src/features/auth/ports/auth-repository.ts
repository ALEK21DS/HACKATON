import type { User } from '@/entities/user';

export interface AuthRepository {
  login(email: string, password: string): Promise<unknown>;
  loginLegacy(phone: string, password: string): Promise<unknown>;
  getMe(): Promise<User>;
  logout(): void;
  isLoggedIn(): boolean;
}
