import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
  ConflictException,
  Logger,
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
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { ChainAction } from '../audit/types/audit.types';

@Injectable()
export class VoteService {
  private readonly logger = new Logger(VoteService.name);

  constructor(
    private readonly repo: VotingsRepository,
    private readonly redis: RedisVotingService,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
    @Inject(forwardRef(() => VoteGateway))
    private readonly gateway: VoteGateway,
  ) {}

  // ─── Token ────────────────────────────────────────────────────────────────────

  async requestToken(
    votingId: string,
    user: { id: string; email: string; language: string; theme: string },
    selections: {
      optionIds: string[];
      otherText?: string;
      isAbstention?: boolean;
    },
  ) {
    this.logger.debug(
      `Requesting voting token for user ${user.id} ${user.language} ${user.theme} on voting ${votingId}`,
    );
    const voting = await this.repo.findVotingById(votingId);
    if (!voting) throw new NotFoundException('Voting not found');

    const hasVoted = await this.redis.hasUserVoted(votingId, user.id);
    if (hasVoted)
      throw new ConflictException('Already participated in this voting');

    // Store selections in Redis (TTL matches token — 1hr)
    await this.redis.setSelections(user.id, votingId, selections, 3600);

    const token = await this.redis.issueToken(
      'voting',
      user.id,
      votingId,
      3600,
    );

    try {
      await this.mailService.sendVotingToken(
        user.email,
        token,
        voting.title,
        votingId,
        user.language,
        user.theme,
      );
    } catch (err) {
      this.logger.error('Failed to send voting token', err);
    }

    try {
      await this.auditService.appendChain({
        action: ChainAction.VOTING_TOKEN_ISSUED,
        payload: {
          votingId,
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        },
        userId: user.id,
        votingId,
        groupId: voting.groupId,
      });
    } catch (err) {
      this.logger.error('Failed to write audit log for token request', err);
    }

    return { status: 'Success', message: 'Voting token sent to email' };
  }

  async confirmVoteFromEmail(
    votingId: string,
    rawToken: string,
  ): Promise<{
    success: boolean;
    message?: string;
    receipts?: string[];
    theme?: string;
    language?: string;
  }> {
    let userId!: string;
    try {
      const hash = CryptoUtils.hashToken(rawToken);

      // look up who owns this token
      const tokenMeta = await this.redis.lookupTokenByHash(hash);
      if (!tokenMeta || tokenMeta.entityId !== votingId) {
        return { success: false, message: 'Invalid or expired voting token.' };
      }

      userId = tokenMeta.userId;
      this.logger.debug(
        `Confirming vote for user ${userId} on voting ${votingId}`,
      );

      const storedHash = await this.redis.getStoredHash(
        'voting',
        userId,
        votingId,
      );
      if (!storedHash || storedHash !== hash) {
        return { success: false, message: 'Token already used or expired.' };
      }

      const selections = await this.redis.getSelections(userId, votingId);

      if (!selections) {
        return {
          success: false,
          message:
            'Vote selections expired. Please return to the voting page and try again.',
        };
      }
      const { optionIds, otherText, isAbstention } = selections;

      // get user email for receipt

      const user = await this.usersService.findOne(userId);
      this.logger.debug(
        `Confirming vote for user ${userId} ${user.language} ${user.theme} on voting ${votingId}`,
      );
      await this.redis.deleteSelections(userId, votingId);

      const result = await this.vote(
        votingId,
        optionIds.map((id: string) => ({ optionId: id })),
        {
          id: userId,
          email: user.email,
          language: user.language,
          theme: user.theme,
        },
        rawToken,
        otherText,
        isAbstention,
      );

      return {
        success: true,
        receipts: result.receipts,
        theme: user.theme,
        language: user.language,
      };
    } catch (err: any) {
      this.logger.error(`Confirm vote failed: ${err.message}`, err.stack);
      return {
        success: false,
        message: err?.message ?? 'Something went wrong.',
      };
    }
  }

  // ─── Vote ─────────────────────────────────────────────────────────────────────

  async vote(
    votingId: string,
    ballots: IBallotInput[],
    user: { id: string; email: string; language: string; theme: string },
    token: string,
    otherText?: string,
    isAbstention?: boolean,
  ) {
    const lockKey = `vote_lock:${votingId}:${user.id}`;
    let lockToken: string | null = null;

    let votingTitle!: string;
    const receipts: string[] = [];
    let tokenHashed!: string;
    let groupId!: string;
    let optionIdsToTally: string[] = [];

    try {
      lockToken = await this.redis.acquireLock(lockKey, 15);
      if (!lockToken)
        throw new ForbiddenException('Vote submission already in progress');

      const alreadyVoted = await this.redis.hasUserVoted(votingId, user.id);
      if (alreadyVoted) throw new ForbiddenException('Already participated');

      optionIdsToTally = ballots.map((b) => b.optionId);

      await this.repo.$transaction(async (tx) => {
        const voting = await this.repo.findVotingForVote(tx, votingId);
        if (!voting) throw new NotFoundException('Voting not found');
        if (voting.isFinalized)
          throw new ForbiddenException('This voting has been finalized');
        votingTitle = voting.title;
        groupId = voting.groupId;

        // ── Token verification ───────────────────────────────────────────────
        await this.redis.verifyToken('voting', user.id, votingId, token);

        tokenHashed = CryptoUtils.hashToken(token);
        // ── Voting guards ────────────────────────────────────────────────────
        this.assertTiming(voting);

        const trimmedOther = otherText?.trim();
        if (trimmedOther && !voting.allowOther)
          throw new ForbiddenException(
            'This voting does not allow an "Other" answer',
          );

        const hasOther = !!trimmedOther;

        if (ballots.length === 0 && !hasOther && !isAbstention)
          throw new BadRequestException(
            'You must select an option or provide an "Other" answer',
          );

        if (isAbstention && (ballots.length > 0 || hasOther))
          throw new BadRequestException(
            'Conflicting vote: Abstention selected along with other options',
          );

        if (ballots.length > 0) {
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

        // ── Build hashed ballots ─────────────────────────────────────────────
        const ballotsHashed: Array<{
          optionId: string | null;
          isAbstention: boolean;
          ballotHash: string;
          tokenHashed: string;
        }> = ballots.map((b) => {
          const receipt = CryptoUtils.generateBallotReceipt(
            votingId,
            b.optionId,
            tokenHashed,
          );

          receipts.push(receipt);
          return {
            optionId: b.optionId,
            isAbstention: false,
            ballotHash: receipt,
            tokenHashed,
          };
        });

        if (isAbstention) {
          const receipt = CryptoUtils.generateBallotReceipt(
            votingId,
            'abstention',
            tokenHashed,
          );
          receipts.push(receipt);
          ballotsHashed.push({
            optionId: null,
            isAbstention: true,
            ballotHash: receipt,
            tokenHashed,
          });
        }

        // ── Participation guard (DB canonical truth) ─────────────────────────
        const existing = await tx.voteParticipation.findUnique({
          where: { userId_votingId: { userId: user.id, votingId } },
          select: { id: true },
        });
        if (existing)
          throw new ForbiddenException('Already participated in this voting');

        await this.repo.createParticipationTx(tx, user.id, votingId);

        // ── Handle "Other" as dynamic option ─────────────────────────────────
        if (trimmedOther && voting.allowOther) {
          let option = await tx.option.findFirst({
            where: { votingId, text: trimmedOther, isDynamic: true },
          });

          if (!option) {
            option = await tx.option.create({
              data: { votingId, text: trimmedOther, isDynamic: true },
            });
          }

          const otherReceipt = CryptoUtils.generateBallotReceipt(
            votingId,
            option.id,
            tokenHashed,
          );
          receipts.push(otherReceipt);
          ballotsHashed.push({
            optionId: option.id,
            isAbstention: false,
            ballotHash: otherReceipt,
            tokenHashed,
          });
          optionIdsToTally.push(option.id);
        }
        // ── Consume token and write ballots ──────────────────────────────────
        if (ballotsHashed.length > 0) {
          await this.repo.createBallotsTx(tx, votingId, ballotsHashed);
        }
      });

      await this.redis.consumeToken('voting', user.id, votingId);

      try {
        await this.redis.performVote(
          votingId,
          optionIdsToTally,
          user.id,
          isAbstention,
        );
      } catch (err) {
        this.logger.error(
          `Redis vote cache update failed for voting ${votingId}: ${err}`,
        );
      }

      try {
        await this.auditService.appendChain({
          action: ChainAction.BALLOT_CAST,
          payload: {
            ballotHashes: receipts,
            tokenHashed: tokenHashed,
            optionCount: ballots.length,
            hasOther: !!otherText,
            isAbstention: !!isAbstention,
          },
          votingId,
          groupId,
        });
      } catch (err) {
        this.logger.error(
          `Audit chain write failed for BALLOT_CAST voting ${votingId}: ${err}`,
        );
      }

      try {
        this.logger.debug(
          `Sending receipt email to user ${user.language} ${user.theme} for voting ${votingId}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1500));

        await this.mailService.sendVoteReceipt(
          user.email,
          votingTitle,
          votingId,
          receipts,
          user.language,
          user.theme,
        );
      } catch (err) {
        this.logger.error(`Receipt email failed for user ${user.id}: ${err}`);
      }

      // ── Broadcast live results ────────────────────────────────────────────
      const results = await this.getResults(votingId);
      this.broadcastResults(votingId, results);

      return {
        participated: true,
        receipts,
        proof: {
          verifyUrl: `/votings/${votingId}/verify-receipt`,
          chainUrl: `/audit/votings/${votingId}/audit-chain`,
        },
      };
    } finally {
      if (lockToken) await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  // ─── Results ──────────────────────────────────────────────────────────────────

  async getResults(
    votingId: string,
    includeRawOther = false,
  ): Promise<IVotingResults> {
    const [cached, rawWithCounts, voting] = await Promise.all([
      this.redis.getResults(votingId),
      this.repo.findOptionsWithBallotCounts(votingId),
      this.repo.findVotingAllowOther(votingId),
    ]);

    const options = rawWithCounts ?? [];
    let allOptions: IOptionResult[];
    let abstentionsCount = 0;

    if (cached && Object.keys(cached).length > 0) {
      allOptions = options.map((o) => ({
        id: o.id,
        text: o.text,
        isDynamic: o.isDynamic,
        voteCount: parseInt(cached[o.id] ?? '0'),
      }));
      abstentionsCount = parseInt(cached['ABSTENTION_COUNT'] ?? '0');
    } else {
      const [dbOptions, dbAbstentions] = await Promise.all([
        this.repo.findOptionsWithBallotCounts(votingId),
        this.repo.countAbstentions(votingId),
      ]);
      allOptions = dbOptions.map((o) => ({
        id: o.id,
        text: o.text,
        isDynamic: o.isDynamic,
        voteCount: o._count.ballots,
      }));
      abstentionsCount = dbAbstentions;
    }

    const staticOptions = allOptions.filter((o) => !o.isDynamic);
    const dynamicOptions = allOptions.filter((o) => o.isDynamic);

    const otherTotal = dynamicOptions.reduce((sum, o) => sum + o.voteCount, 0);
    const staticTotal = staticOptions.reduce((sum, o) => sum + o.voteCount, 0);
    const totalBallots = staticTotal + otherTotal + abstentionsCount;

    return {
      options: staticOptions,
      totalBallots,
      abstentionsCount,
      otherTotal: voting?.allowOther ? otherTotal : undefined,
      dynamicOptions: voting?.allowOther ? dynamicOptions : undefined,
    };
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

    // verify voting chain before sealing
    const verifyResult = await this.auditService.verifyVotingChain(votingId);

    const options = await this.repo.findOptionsWithBallotCounts(votingId);

    const tally = {
      options: Object.fromEntries(options.map((o) => [o.id, o._count.ballots])),
    };

    const totalBallots = await this.repo.countBallotsByVoting(votingId);
    const tallyHash = CryptoUtils.generateTallyHash(tally, totalBallots);

    const result = await this.repo.$transaction((tx) =>
      this.repo.finalizeVoting(tx, votingId, tally, totalBallots, tallyHash),
    );

    // seal the audit chain with verification result
    try {
      await this.auditService.appendChain({
        action: ChainAction.VOTING_RESULT_SEALED,
        payload: {
          tallyHash,
          totalBallots,
          chainVerified: verifyResult.valid,
          chainBlocksChecked: verifyResult.totalChecked,
          chainBrokenAt: verifyResult.brokenAt,
        },
        votingId,
        groupId: voting.groupId,
      });
    } catch (err) {
      this.logger.error(`Audit write failed for VOTING_RESULT_SEALED: ${err}`);
    }

    return { ...result, chainVerified: verifyResult.valid };
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
    if (voting.startAt && now < voting.startAt)
      throw new ForbiddenException('Voting has not started yet');
    if (voting.endAt && now > voting.endAt)
      throw new ForbiddenException('Voting has ended');
  }

  private assertOptionIds(
    voting: { options: { id: string }[] },
    optionIds: string[],
  ) {
    const validIds = new Set(voting.options.map((o) => o.id));
    const invalid = optionIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0)
      throw new BadRequestException(
        `Invalid option IDs: ${invalid.join(', ')}`,
      );
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

    if (voting.type === VotingType.SINGLE_CHOICE && effectiveCount > 1)
      throw new BadRequestException(
        'This voting does not allow multiple selections',
      );

    if (ballots.length > 0 && ballots.length < voting.minChoices && !hasOther)
      throw new BadRequestException(
        `You must select at least ${voting.minChoices} option(s)`,
      );

    if (voting.maxChoices !== null && effectiveCount > voting.maxChoices)
      throw new BadRequestException(
        `You can select at most ${voting.maxChoices} option(s)`,
      );
  }

  // ─── Receipt verification ────────────────────────────────────────────────────────
  async verifyReceipt(votingId: string, hash: string) {
    const voting = await this.repo.findVotingAllowOther(votingId);
    if (!voting) throw new NotFoundException('Voting not found');
    return this.auditService.findBallotReceipt(votingId, hash);
  }
}
