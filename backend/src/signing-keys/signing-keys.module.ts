import { Module, Global } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SigningKeysService } from './signing-keys.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [SigningKeysService],
  exports: [SigningKeysService],
})
export class SigningKeysModule {}
