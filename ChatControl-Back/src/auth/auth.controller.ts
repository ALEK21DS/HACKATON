import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthService, LoginDto } from './auth.service';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

class LoginBodyDto implements LoginDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async login(@Body() dto: LoginBodyDto) {
    return this.authService.login(dto);
  }
}
