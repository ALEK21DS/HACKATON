import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { OrganizationStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser, JwtPayload } from './auth.types';

export interface LoginDto {
  email: string;
  password: string;
}

/** Login MVP legacy: teléfono + APP_LOGIN_PASSWORD (solo si existe usuario con ese email = teléfono@legacy.local) */
export interface LegacyLoginDto {
  phone: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async login(dto: LoginDto): Promise<{ access_token: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (user.organizationId && user.organization?.status === OrganizationStatus.SUSPENDED) {
      throw new ForbiddenException('La cuenta de la empresa está suspendida');
    }
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
    const access_token = this.jwtService.sign(payload);
    return { access_token };
  }

  /**
   * Compatibilidad con login anterior: mismo body { phone, password }.
   * Si APP_LOGIN_PASSWORD coincide, emite JWT para el usuario con email `phone@legacy.chatcontrol`.
   */
  async loginLegacy(dto: LegacyLoginDto): Promise<{ access_token: string }> {
    const expectedPassword = this.config.get<string>('APP_LOGIN_PASSWORD');
    if (!expectedPassword || dto.password !== expectedPassword) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const phone = dto.phone.replace(/\s+/g, '').replace(/^\+/, '');
    if (!phone || phone.length < 8) {
      throw new UnauthorizedException('Número de teléfono inválido');
    }
    const legacyEmail = `${phone}@legacy.chatcontrol`;
    const user = await this.prisma.user.findUnique({
      where: { email: legacyEmail },
      include: { organization: true },
    });
    if (!user) {
      throw new UnauthorizedException(
        'No hay usuario vinculado a este login legacy. Ejecuta prisma db seed o crea un usuario con email ' +
          legacyEmail,
      );
    }
    if (user.organizationId && user.organization?.status === OrganizationStatus.SUSPENDED) {
      throw new ForbiddenException('La cuenta de la empresa está suspendida');
    }
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
    return { access_token: this.jwtService.sign(payload) };
  }

  async validatePayload(payload: JwtPayload): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { organization: true },
    });
    if (!user) return null;
    if (user.organizationId && user.organization?.status === OrganizationStatus.SUSPENDED) {
      return null;
    }
    return {
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      organizationId: user.organizationId,
    };
  }

  async getMe(userId: string): Promise<{
    id: string;
    email: string;
    displayName: string | null;
    role: UserRole;
    organizationId: string | null;
    organizationName: string | null;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: { select: { id: true, name: true } } },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organization?.name ?? null,
    };
  }
}
