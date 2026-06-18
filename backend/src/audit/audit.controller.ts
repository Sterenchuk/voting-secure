import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Body,
} from '@nestjs/common';

import { AuditService } from './audit.service';
import { AuditVerifyGuard } from './audit-verify.guard';
import { GroupRoleGuard } from '../common/guards/group-role.guard';
import { GroupRoles } from '../common/decorators/group-roles.decorator';
import { GroupRole } from '../common/enums/group-role';
import { VerifyResult, ScopedVerifyResult } from './types/audit.types';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { InjectModel } from '@nestjs/mongoose';
import { AuditVerificationJob } from './schemas/audit-verification-job.schema';
import { Model } from 'mongoose';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    @InjectModel(AuditVerificationJob.name)
    private readonly jobModel: Model<AuditVerificationJob>,
  ) {}

  @Get()
  @UseGuards(AuditVerifyGuard)
  async getGlobalChain(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    return this.auditService.searchChain({
      page: Number(page),
      limit: Number(pageSize),
    });
  }

  @Get('search')
  @UseGuards(AuditVerifyGuard)
  async searchChain(
    @Query('hash') hash?: string,
    @Query('sequence') sequence?: number,
    @Query('action') action?: string,
    @Query('votingId') votingId?: string,
    @Query('surveyId') surveyId?: string,
    @Query('userId') userId?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.auditService.searchChain({
      hash,
      sequence,
      action,
      votingId,
      surveyId,
      userId,
      page: Number(page),
      limit: Number(limit),
    });
  }

  // ── Global (platform admin only) ──────────────────────────────────────────

  @Get('verify')
  @UseGuards(AuditVerifyGuard)
  @HttpCode(HttpStatus.OK)
  async verifyFullChain() {
    const jobId = await this.auditService.startVerification('global');
    return { jobId };
  }

  // ── Async Verification ────────────────────────────────────────────────────

  @Get('status')
  @Public()
  async getAuditStatus(
    @Query('scope') scope: 'global' | 'group' | 'voting' | 'survey',
    @Query('scopeId') scopeId?: string,
  ) {
    return this.auditService.getAuditStatus(scope, scopeId || null);
  }

  @Post('verify/start')
  @Public()
  async startVerification(
    @Body() body: { scope: string; scopeId?: string; forceFull?: boolean },
  ) {
    const jobId = await this.auditService.startVerification(
      body.scope,
      body.scopeId,
      body.forceFull,
    );
    return { jobId };
  }

  @Get('verify/status/:jobId')
  @Public()
  async getStatus(@Param('jobId') jobId: string) {
    const job = await this.jobModel.findById(jobId);
    if (!job) return { status: 'not-found' };
    return job;
  }

  // ── Group scope ───────────────────────────────────────────────────────────

  @Get('verify/group/:groupId')
  @UseGuards(GroupRoleGuard, AuditVerifyGuard)
  @GroupRoles(GroupRole.OWNER, GroupRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async verifyGroupChain(@Param('groupId') groupId: string) {
    const jobId = await this.auditService.startVerification('group', groupId);
    return { jobId };
  }

  // ── Voting scope ──────────────────────────────────────────────────────────

  @Get('verify/voting/:votingId')
  @Public()
  @HttpCode(HttpStatus.OK)
  async verifyVotingChain(@Param('votingId') votingId: string) {
    const jobId = await this.auditService.startVerification('voting', votingId);
    return { jobId };
  }

  // ── Compromised blocks ────────────────────────────────────────────────────
  //
  // forceFull=true clears the DB-level lastVerifiedSequence so the verifier
  // rescans from genesis rather than from the last cached checkpoint.
  // This is necessary when tampering happened at a sequence that was already
  // marked as verified before the tamper occurred.

  @Get('audit-chain/:id/compromised')
  @Public()
  async getCompromisedBlocks(
    @Param('id') scopeId: string,
    @Query('scope') scope: 'voting' | 'survey',
    @Query('forceFull') forceFull?: string,
  ) {
    return await this.auditService.getCompromisedBlocks(
      scope,
      scopeId,
      forceFull === 'true',
    );
  }

  @Get('votings/audit-chain/:id')
  @Public()
  async getVotingAuditChain(
    @Param('id') votingId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return await this.auditService.getVotingChain(
      votingId,
      Number(page),
      Number(limit),
    );
  }

  @Get('surveys/audit-chain/:id')
  @Public()
  async getSurveyAuditChain(
    @Param('id') surveyId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return await this.auditService.getSurveyChain(
      surveyId,
      Number(page),
      Number(limit),
    );
  }

  @Post('tamper/:sequence')
  @Public()
  async tamper(
    @Param('sequence') sequence: string,
    @Query('hash') hash?: string,
  ) {
    const seq = parseInt(sequence, 10);
    const newHash =
      hash || `HACKED_HASH_${Math.random().toString(36).substring(7)}`;

    await this.auditService.tamper(seq, newHash);
    return {
      success: true,
      message: `Attempted to tamper with Block #${seq}`,
      newHash,
    };
  }
}
