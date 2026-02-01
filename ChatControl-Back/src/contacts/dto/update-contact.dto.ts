import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateContactDto {
  @IsString()
  @IsOptional()
  name?: string;

  /** Solo pruebas: número autorizado en Meta (sandbox). TODO: eliminar en producción. */
  @IsBoolean()
  @IsOptional()
  isSandboxAuthorized?: boolean;
}
