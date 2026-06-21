import { NestFactory } from '@nestjs/core';
import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { MailModule } from '../mail/mail.module';
import { MailProcessor } from '../mail/mail.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
        },
      }),
    }),
    MailModule,
  ],
  providers: [MailProcessor],
})
class MailWorkerModule {}

async function bootstrap() {
  const logger = new Logger('MailWorker');
  const app = await NestFactory.createApplicationContext(MailWorkerModule);

  logger.log('🚀 Mail Worker is running and listening for jobs...');

  process.on('SIGTERM', async () => {
    logger.log('Shutting down Mail Worker...');
    await app.close();
    process.exit(0);
  });
}

bootstrap();
