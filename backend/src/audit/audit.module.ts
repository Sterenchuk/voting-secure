// src/audit/audit.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';

import { AuditChain, AuditChainSchema } from './schemas/audit-chain.schema';
import {
  AuditSecurity,
  AuditSecuritySchema,
} from './schemas/audit-security.schema';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditChain.name, schema: AuditChainSchema },
      { name: AuditSecurity.name, schema: AuditSecuritySchema },
    ]),
    JwtModule.register({}),
  ],
  providers: [AuditService, AuditInterceptor],
  controllers: [AuditController],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
