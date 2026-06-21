import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';

import { AuditChain, AuditChainSchema } from './schemas/audit-chain.schema';
import {
  AuditSecurity,
  AuditSecuritySchema,
} from './schemas/audit-security.schema';
import {
  AuditVerification,
  AuditVerificationSchema,
} from './schemas/audit-verification.schema';
import {
  AuditVerificationJob,
  AuditVerificationJobSchema,
} from './schemas/audit-verification-job.schema';
import {
  AuditCheckpoint,
  AuditCheckpointSchema,
} from './schemas/audit-checkpoint.schema';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditChain.name, schema: AuditChainSchema },
      { name: AuditSecurity.name, schema: AuditSecuritySchema },
      { name: AuditVerification.name, schema: AuditVerificationSchema },
      { name: AuditVerificationJob.name, schema: AuditVerificationJobSchema },
      { name: AuditCheckpoint.name, schema: AuditCheckpointSchema },
    ]),
    BullModule.registerQueue({
      name: 'audit',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    }),
    DatabaseModule,
    RedisModule,
  ],
  providers: [AuditService, AuditInterceptor], // NO AuditProcessor
  controllers: [AuditController],
  exports: [AuditService, AuditInterceptor, MongooseModule], // NO AuditProcessor
})
export class AuditModule {}
