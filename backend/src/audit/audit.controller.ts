import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { AuditService } from './audit.service';
import { AuditVerifyGuard } from './audit-verify.guard';
import { VerifyResult } from './types/audit.types';
import { Public } from '../common/decorators/public.decorator';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('votings/:id/audit-chain')
  @Public()
  getAuditChain(@Param('id') votingId: string) {
    return this.auditService.getVotingChain(votingId);
  }

  @Get('verify')
  @UseGuards(AuditVerifyGuard)
  @HttpCode(HttpStatus.OK)
  async verifyFullChain(): Promise<VerifyResult> {
    return this.auditService.verifyChain();
  }

  /**
   * GET /audit/verify/:groupId
   * Platform ADMIN or group OWNER/ADMIN — walks only entries for that group.
   *
   * Note: sequence gaps are NOT checked for group-scoped verification
   * (gaps are expected because entries from other groups sit between them).
   * Only per-entry hash integrity is verified.
   */
}
