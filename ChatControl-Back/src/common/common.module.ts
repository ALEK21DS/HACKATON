import { Global, Module } from '@nestjs/common';
import { SecretsCryptoService } from './secrets-crypto.service';

@Global()
@Module({
  providers: [SecretsCryptoService],
  exports: [SecretsCryptoService],
})
export class CommonModule {}
