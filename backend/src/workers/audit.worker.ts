import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { AuditModule } from '../audit/audit.module';
import { AuditProcessor } from '../audit/audit.processor';
import { Logger } from '@nestjs/common';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get('REDIS_PORT', 6379),
        },
      }),
    }),
    AuditModule,
  ],
})
class AuditWorkerModule {}

async function bootstrap() {
  const logger = new Logger('AuditWorker');
  const app = await NestFactory.createApplicationContext(AuditWorkerModule);
  
  logger.log('🚀 Audit Worker is running and listening for jobs...');
  
  process.on('SIGTERM', async () => {
    logger.log('Shutting down Audit Worker...');
    await app.close();
    process.exit(0);
  });
}

bootstrap();
