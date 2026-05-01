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
import { VerifyResult, ScopedVerifyResult } from './types/audit.types';
import { Public } from '../common/decorators/public.decorator';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('votings/:id/audit-chain')
  @Public()
  getAuditChain(@Param('id') votingId: string) {
    return this.auditService.getVotingChain(votingId);
  }

  // ── Global (platform admin only) ──────────────────────────────────────────

  @Get('verify')
  @UseGuards(AuditVerifyGuard)
  @HttpCode(HttpStatus.OK)
  verifyFullChain(): Promise<VerifyResult> {
    return this.auditService.verifyChain();
  }

  // ── Group scope ───────────────────────────────────────────────────────────

  @Get('verify/group/:groupId')
  @UseGuards(AuditVerifyGuard)
  @HttpCode(HttpStatus.OK)
  verifyGroupChain(
    @Param('groupId') groupId: string,
  ): Promise<ScopedVerifyResult> {
    return this.auditService.verifyGroupChain(groupId);
  }

  // ── Voting scope (public — participants can verify their own voting) ───────

  @Get('verify/voting/:votingId')
  @Public()
  @HttpCode(HttpStatus.OK)
  verifyVotingChain(
    @Param('votingId') votingId: string,
  ): Promise<ScopedVerifyResult> {
    return this.auditService.verifyVotingChain(votingId);
  }

  // ── Survey scope (public) ─────────────────────────────────────────────────

  @Get('verify/survey/:surveyId')
  @Public()
  @HttpCode(HttpStatus.OK)
  verifySurveyChain(
    @Param('surveyId') surveyId: string,
  ): Promise<ScopedVerifyResult> {
    return this.auditService.verifySurveyChain(surveyId);
  }
}
