import {
  getMe,
  isLoggedIn,
  login,
  loginLegacy,
  logout,
} from '@/shared/api/chatcontrol/client';
import type { AuthRepository } from '../ports/auth-repository';

export const httpAuthRepository: AuthRepository = {
  login,
  loginLegacy,
  getMe,
  logout,
  isLoggedIn,
};
