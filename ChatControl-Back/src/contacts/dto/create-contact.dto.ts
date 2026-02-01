import { IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateContactDto {
  @IsString()
  @MinLength(1)
  @Matches(/^[0-9+\s\-()]+$/, { message: 'El número debe contener solo dígitos y opcionalmente +, espacios o guiones' })
  phone!: string;

  @IsString()
  @IsOptional()
  name?: string;

  /** Solo pruebas: número autorizado en Meta (sandbox). TODO: eliminar en producción. */
  @IsBoolean()
  @IsOptional()
  isSandboxAuthorized?: boolean;
}
