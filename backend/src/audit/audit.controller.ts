import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';

import { AuditService } from './audit.service';
import { AuditVerifyGuard } from './audit-verify.guard';
import { GroupRoleGuard } from '../common/guards/group-role.guard';
import { GroupRoles } from '../common/decorators/group-roles.decorator';
import { GroupRole } from '../common/enums/group-role';
import { VerifyResult, ScopedVerifyResult } from './types/audit.types';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // ── Global (platform admin only) ──────────────────────────────────────────

  @Get('verify')
  @UseGuards(AuditVerifyGuard)
  @HttpCode(HttpStatus.OK)
  verifyFullChain(
    @Query('forceFull') forceFull?: string,
  ): Promise<VerifyResult> {
    return this.auditService.verifyChain(null, forceFull === 'true');
  }

  // ── Group scope ───────────────────────────────────────────────────────────

  @Get('verify/group/:groupId')
  @UseGuards(GroupRoleGuard, AuditVerifyGuard)
  @GroupRoles(GroupRole.OWNER, GroupRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  verifyGroupChain(
    @Param('groupId') groupId: string,
    @Query('forceFull') forceFull?: string,
  ): Promise<ScopedVerifyResult> {
    return this.auditService.verifyChain(groupId, forceFull === 'true');
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

  @Get('votings/audit-chain/:id')
  @Public()
  getVotingAuditChain(@Param('id') votingId: string) {
    return this.auditService.getVotingChain(votingId);
  }

  @Get('surveys/audit-chain/:id')
  @Public()
  getSurveyAuditChain(@Param('id') surveyId: string) {
    return this.auditService.getSurveyChain(surveyId);
  }
}
