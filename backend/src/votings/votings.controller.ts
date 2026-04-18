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

@UseGuards(JwtAuthGuard)
@Controller('votings')
export class VotingsController {
  constructor(
    private readonly votingsService: VotingsService,
    private readonly voteService: VoteService,
  ) {}

  // ─── Voting CRUD ──────────────────────────────────────────────────────────────

  @Post()
  create(@Body() dto: VotingCreateDto, @Req() req: any) {
    return this.votingsService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Query() dto: FindVotingQueryDto) {
    return this.votingsService.findAll(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.votingsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: VotingUpdateDto,
    @Req() req: any,
  ) {
    return this.votingsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.votingsService.delete(id, req.user.id);
  }

  // ─── Vote casting ─────────────────────────────────────────────────────────────

  @Post(':id/vote')
  vote(
    @Param('id') votingId: string,
    @Body() dto: CastVoteDto,
    @Req() req: any,
  ) {
    return this.voteService.vote(
      votingId,
      dto.ballots,
      req.user.id,
      dto.otherText,
      dto.freeformBallotHash,
    );
  }

  // ─── Results ──────────────────────────────────────────────────────────────────

  /**
   * GET /votings/:id/results
   * Returns live (unsealed) aggregated results — visible to everyone.
   */
  @Get(':id/results')
  getResults(@Param('id') votingId: string) {
    return this.voteService.getResults(votingId);
  }

  /**
   * GET /votings/:id/results/admin
   * Returns live results including raw freeform answers.
   * Restricted to ADMIN and AUDITOR roles.
   */
  @Get(':id/results/admin')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.AUDITOR)
  getAdminResults(@Param('id') votingId: string) {
    return this.voteService.getResults(votingId, true);
  }

  /**
   * GET /votings/:id/results/sealed
   * Returns the immutable sealed tally (Rec §56).
   * Only available after finalization.
   */
  @Get(':id/results/sealed')
  getSealedResult(@Param('id') votingId: string) {
    return this.voteService.getSealedResult(votingId);
  }

  // ─── Finalization (Rec §56) ───────────────────────────────────────────────────

  /**
   * POST /votings/:id/finalize
   * Seals results into an immutable VotingResult row and closes the voting.
   * Restricted to ADMIN role.
   */
  @Post(':id/finalize')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  finalize(@Param('id') votingId: string, @Req() req: any) {
    return this.voteService.finalizeVoting(votingId, req.user.id);
  }

  // ─── User participation status ────────────────────────────────────────────────

  /**
   * GET /votings/:id/my-vote
   * Returns whether the authenticated user has voted — never what they voted.
   * Rec(2004)11: you must never reveal a user's choices after the fact.
   */
  @Get(':id/my-vote')
  getUserVote(@Param('id') votingId: string, @Req() req: any) {
    return this.voteService.getUserVote(votingId, req.user.id);
  }
}
