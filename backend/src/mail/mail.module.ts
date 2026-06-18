import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';

@Global()
@Module({
  imports: [ConfigModule, BullModule.registerQueue({ name: 'mail' })],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
