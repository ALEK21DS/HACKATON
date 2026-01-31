import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface LoginDto {
  phone: string;
  password: string;
}

export interface JwtPayload {
  sub: string;
  phone: string;
}

/**
 * Servicio de autenticación MVP.
 * Login: número de teléfono + contraseña fija definida en .env
 * TODO: Futuro multi-empresa - usuarios por empresa, roles, etc.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<{ access_token: string }> {
    const expectedPassword = this.config.get<string>('APP_LOGIN_PASSWORD');
    if (!expectedPassword) {
      throw new UnauthorizedException('Configuración de login incompleta');
    }
    if (dto.password !== expectedPassword) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    // Normalizar teléfono (quitar espacios, aceptar con/sin prefijo)
    const phone = dto.phone.replace(/\s+/g, '').replace(/^\+/, '');
    if (!phone || phone.length < 8) {
      throw new UnauthorizedException('Número de teléfono inválido');
    }
    const payload: JwtPayload = { sub: phone, phone };
    const access_token = this.jwtService.sign(payload);
    return { access_token };
  }

  async validatePayload(payload: JwtPayload): Promise<{ phone: string }> {
    return { phone: payload.phone };
  }
}
