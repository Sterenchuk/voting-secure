import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
  ConflictException,
} from '@nestjs/common';
import { VotingsRepository } from './votings.repository';
import { RedisVotingService } from '../redis/redis.service';
import { VoteGateway } from './vote.gateway';
import {
  IBallotInput,
  IVotingResults,
  IOptionResult,
  IUserVoteStatus,
  VotingType,
} from './types/voting.types';
import { CryptoUtils } from '../common/utils/crypto-utils';
import { GroupsService } from '../groups/groups.service';

@Injectable()
export class VoteService {
  constructor(
    private readonly repo: VotingsRepository,
    private readonly redis: RedisVotingService,
    private readonly groupService: GroupsService,
    @Inject(forwardRef(() => VoteGateway))
    private readonly gateway: VoteGateway,
  ) {}

  async vote(
    votingId: string,
    ballots: IBallotInput[],
    userId: string,
    otherText?: string,
    freeformBallotHash?: string,
  ) {
    const lockKey = `vote_lock:${votingId}:${userId}`;
    let lockToken: string | null = null;

    try {
      lockToken = await this.redis.acquireLock(lockKey, 15);
      if (!lockToken)
        throw new ForbiddenException('Vote submission already in progress');

      // Fast pre-check before hitting the DB
      const alreadyVoted = await this.redis.hasUserVoted(votingId, userId);
      if (alreadyVoted)
        throw new ForbiddenException(
          'You have already participated in this voting',
        );

      const result = await this.repo.$transaction(async (tx) => {
        const voting = await this.repo.findVotingForVote(tx, votingId);
        if (!voting) throw new NotFoundException('Voting not found');
        if (voting.isFinalized)
          throw new ForbiddenException('This voting has been finalized');

        this.assertTiming(voting);

        if (!voting.isOpen) {
          await this.groupService.checkMembership(userId, voting.groupId, tx);
        }

        const existing = await this.repo.findParticipation(userId, votingId);
        if (existing)
          throw new ConflictException(
            'You have already participated in this voting',
          );

        const trimmedOther = otherText?.trim();
        if (trimmedOther && !voting.allowOther) {
          throw new ForbiddenException(
            'This voting does not allow an "Other" answer',
          );
        }

        const hasOptionBallots = ballots.length > 0;
        const hasOther = !!trimmedOther;

        if (!hasOptionBallots && !hasOther) {
          throw new BadRequestException(
            'You must select an option or provide an "Other" answer',
          );
        }

        if (hasOptionBallots) {
          this.assertOptionIds(
            voting,
            ballots.map((b) => b.optionId),
          );
          this.assertChoiceCount(
            {
              type: voting.type as VotingType,
              minChoices: voting.minChoices,
              maxChoices: voting.maxChoices,
            },
            ballots,
            hasOther,
          );
        }

        await this.repo.createParticipationTx(tx, userId, votingId);

        if (hasOptionBallots) {
          await this.repo.createBallotsTx(tx, votingId, ballots);
        }

        const freeform =
          hasOther && freeformBallotHash
            ? await this.repo.createFreeformBallotTx(tx, {
                votingId,
                text: trimmedOther,
                ballotHash: freeformBallotHash,
              })
            : null;

        return { freeform, hasOther };
      });

      await this.redis.performVote(
        votingId,
        ballots.map((b) => b.optionId),
        userId,
        result.hasOther,
      );

      const results = await this.getResults(votingId);
      this.gateway.emitVotingResults(votingId, results);

      return { participated: true, freeform: result.freeform };
    } finally {
      if (lockToken) await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  async getResults(
    votingId: string,
    includeRawFreeform = false,
  ): Promise<IVotingResults> {
    const cached = await this.redis.getResults(votingId);
    let options: IOptionResult[];
    let otherCount = 0;

    if (cached && Object.keys(cached).length > 0) {
      const raw = await this.repo.findOptionsByVoting(votingId);
      options = raw.map((o) => ({
        id: o.id,
        text: o.text,
        voteCount: parseInt(cached[o.id] ?? '0'),
      }));
      otherCount = parseInt(cached['OTHER_COUNT'] ?? '0');
    } else {
      const raw = await this.repo.findOptionsWithBallotCounts(votingId);
      options = raw.map((o) => ({
        id: o.id,
        text: o.text,
        voteCount: o._count.ballots,
      }));
      otherCount = await this.repo.countFreeformBallotsByVoting(votingId);
    }

    const totalBallots =
      options.reduce((sum, o) => sum + o.voteCount, 0) + otherCount;

    const voting = await this.repo.findVotingRaw(votingId);

    if (voting?.allowOther && includeRawFreeform) {
      const other = await this.repo.findFreeformBallotsByVoting(votingId);
      return { options, totalBallots, other };
    }

    if (voting?.allowOther) {
      return {
        options,
        totalBallots,
        otherCount,
      };
    }

    return { options, totalBallots };
  }

  async getSealedResult(votingId: string) {
    const result = await this.repo.findVotingResult(votingId);
    if (!result)
      throw new NotFoundException('This voting has not been finalized yet');
    return result;
  }

  // ─── Finalize ─────────────────────────────────────────────────────────────────

  async finalizeVoting(votingId: string, userId: string) {
    const voting = await this.repo.findVotingRaw(votingId);
    if (!voting) throw new NotFoundException('Voting not found');
    if (voting.isFinalized)
      throw new ConflictException('Voting is already finalized');

    const options = await this.repo.findOptionsWithBallotCounts(votingId);
    const otherCount = await this.repo.countFreeformBallotsByVoting(votingId);

    const tally = {
      options: Object.fromEntries(options.map((o) => [o.id, o._count.ballots])),
      other: otherCount,
    };

    const totalBallots =
      (await this.repo.countBallotsByVoting(votingId)) + otherCount;
    const tallyHash = CryptoUtils.generateTallyHash(tally, totalBallots);

    return this.repo.$transaction((tx) =>
      this.repo.finalizeVoting(tx, votingId, tally, totalBallots, tallyHash),
    );
  }

  // ─── User participation status ────────────────────────────────────────────────

  async getUserVote(
    votingId: string,
    userId: string,
  ): Promise<IUserVoteStatus> {
    const participation = await this.repo.findParticipation(userId, votingId);
    return { participated: !!participation };
  }

  broadcastResults(votingId: string, results: IVotingResults) {
    this.gateway.emitVotingResults(votingId, results);
  }

  // ─── Private guards ───────────────────────────────────────────────────────────

  private assertTiming(voting: { startAt: Date | null; endAt: Date | null }) {
    const now = new Date();
    if (voting.startAt && now < voting.startAt) {
      throw new ForbiddenException('Voting has not started yet');
    }
    if (voting.endAt && now > voting.endAt) {
      throw new ForbiddenException('Voting has ended');
    }
  }

  private assertOptionIds(
    voting: { options: { id: string }[] },
    optionIds: string[],
  ) {
    const validIds = new Set(voting.options.map((o) => o.id));
    const invalid = optionIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Invalid option IDs: ${invalid.join(', ')}`,
      );
    }
  }

  private assertChoiceCount(
    voting: {
      type: VotingType;
      minChoices: number;
      maxChoices: number | null;
    },
    ballots: IBallotInput[],
    hasOther: boolean,
  ) {
    const effectiveCount = ballots.length + (hasOther ? 1 : 0);

    if (voting.type === VotingType.SINGLE_CHOICE && effectiveCount > 1) {
      throw new BadRequestException(
        'This voting does not allow multiple selections',
      );
    }
    if (ballots.length > 0 && ballots.length < voting.minChoices && !hasOther) {
      throw new BadRequestException(
        `You must select at least ${voting.minChoices} option(s)`,
      );
    }
    if (voting.maxChoices !== null && effectiveCount > voting.maxChoices) {
      throw new BadRequestException(
        `You can select at most ${voting.maxChoices} option(s)`,
      );
    }
  }
}
