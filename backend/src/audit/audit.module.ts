// src/audit/audit.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';

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
import { AuditVerificationQueueService } from './worker/queue.service';
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
    JwtModule.register({}),
    DatabaseModule,
    RedisModule,
  ],
  providers: [AuditService, AuditVerificationQueueService, AuditInterceptor],
  controllers: [AuditController],
  exports: [AuditService, AuditVerificationQueueService, AuditInterceptor],
})
export class AuditModule {}
