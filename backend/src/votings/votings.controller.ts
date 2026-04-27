import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { VotingsService } from './votings.service';
import { VoteService } from './vote.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role';
import { VotingCreateDto } from './dto/voting.create.dto';
import { VotingUpdateDto } from './dto/voting.update.dto';
import { FindVotingQueryDto } from './dto/find.voting.query.dto';
import { CastVoteDto } from './dto/cast.vote.dto';
import { Audit, ChainAction } from '../audit/audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('votings')
export class VotingsController {
  constructor(
    private readonly votingsService: VotingsService,
    private readonly voteService: VoteService,
  ) {}

  // ─── Voting CRUD ──────────────────────────────────────────────────────────────

  @Post()
  @Audit({
    action: ChainAction.VOTING_CREATED,
    extractPayload: (res: any) => ({
      votingId: res.id,
      title: res.title,
    }),
  })
  create(@Body() dto: VotingCreateDto, @Req() req: any) {
    return this.votingsService.create(req.user.sub, dto);
  }

  @Get()
  findAll(@Query() dto: FindVotingQueryDto, @Req() req: any) {
    return this.votingsService.findAll(dto, req.user?.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.votingsService.findOne(id, req.user?.sub);
  }

  @Patch(':id')
  @Audit({
    action: ChainAction.VOTING_UPDATED,
    extractPayload: (res: any) => ({
      votingId: res.id,
      updatedFields: res,
    }),
  })
  update(
    @Param('id') id: string,
    @Body() dto: VotingUpdateDto,
    @Req() req: any,
  ) {
    return this.votingsService.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  @Audit({
    action: ChainAction.VOTING_DELETED,
    extractPayload: (_res: any, req: any) => ({
      votingId: req.params.id,
    }),
  })
  delete(@Param('id') id: string, @Req() req: any) {
    return this.votingsService.delete(id, req.user.sub);
  }

  // ─── Token ────────────────────────────────────────────────────────────────────

  /**
   * POST /votings/:id/token
   * Issues a single-use voting token sent to the user's email.
   * Rec(2004)11 §47 — decouples authentication from ballot casting.
   */
  @Post(':id/token')
  requestToken(
    @Param('id') votingId: string,
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.voteService.requestToken(votingId, user);
  }

  // ─── Vote casting ─────────────────────────────────────────────────────────────

  /**
   * POST /votings/:id/vote
   * Casts a vote. Requires the raw token string from email.
   * BALLOT_CAST is audited directly inside VoteService — NOT via decorator.
   * Reason: requires null userId (§26), receipts, and chain context
   * that are only available inside the service transaction scope.
   */
  @Post(':id/vote')
  vote(
    @Param('id') votingId: string,
    @Body() dto: CastVoteDto,
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.voteService.vote(
      votingId,
      dto.ballots,
      user,
      dto.token,
      dto.otherText,
    );
  }

  // ─── Results ──────────────────────────────────────────────────────────────────

  /**
   * GET /votings/:id/results
   * Live aggregated results — visible to everyone.
   */
  @Get(':id/results')
  getResults(@Param('id') votingId: string) {
    return this.voteService.getResults(votingId);
  }

  /**
   * GET /votings/:id/results/admin
   * Live results including dynamic (other) option breakdown.
   * Restricted to ADMIN and AUDITOR.
   */
  @Get(':id/results/admin')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.AUDITOR)
  getAdminResults(@Param('id') votingId: string) {
    return this.voteService.getResults(votingId, true);
  }

  /**
   * GET /votings/:id/results/sealed
   * Immutable sealed tally — only available after finalization (Rec §56).
   */
  @Get(':id/results/sealed')
  getSealedResult(@Param('id') votingId: string) {
    return this.voteService.getSealedResult(votingId);
  }

  // ─── Finalization ─────────────────────────────────────────────────────────────

  /**
   * POST /votings/:id/finalize
   * Seals results into an immutable VotingResult row.
   * Restricted to ADMIN.
   */
  @Post(':id/finalize')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Audit({
    action: ChainAction.VOTING_FINALIZED,
    extractPayload: (_res: any, req: any) => ({
      votingId: req.params.id,
    }),
  })
  finalize(@Param('id') votingId: string, @Req() req: any) {
    return this.voteService.finalizeVoting(votingId, req.user.sub);
  }

  // ─── User participation status ────────────────────────────────────────────────

  /**
   * GET /votings/:id/my-vote
   * Returns whether the user has voted — never what they voted.
   * Rec(2004)11: choices must never be revealed after the fact.
   */
  @Get(':id/my-vote')
  getUserVote(@Param('id') votingId: string, @Req() req: any) {
    return this.voteService.getUserVote(votingId, req.user.sub);
  }
}
