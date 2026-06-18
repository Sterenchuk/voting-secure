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
import { BroadcastService } from '../broadcast/broadcast.service';
import { SocketEmitterService } from '../broadcast/socket-emitter.service';

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
    private readonly broadcastService: BroadcastService,
    private readonly socketEmitter: SocketEmitterService,
  ) {}

  // ─── Token ────────────────────────────────────────────────────────────────────

  async requestToken(
    votingId: string,
    user: { id: string; email: string; language: string; theme: string },
    selections: {
      optionIds: string[];
      otherText?: string;
      isAbstention?: boolean;
      isPractice?: boolean;
    },
  ) {
    const voting = await this.repo.findVotingById(votingId);
    if (!voting) throw new NotFoundException('Voting not found');

    if (!selections.isPractice) {
      const hasVoted = await this.redis.hasUserVoted(votingId, user.id);
      if (hasVoted)
        throw new ConflictException('Already participated in this voting');
    }

    // Store selections in Redis (TTL matches token — 1hr)
    await this.redis.setSelections(user.id, votingId, selections, 3600);

    const token = await this.redis.issueToken(
      'voting',
      user.id,
      votingId,
      3600,
      selections.isPractice,
    );

    if (selections.isPractice) {
      return {
        status: 'Success',
        message: 'Practice token generated',
        token,
      };
    }

    // Fire-and-forget: do not block token response on email delivery
    this.mailService
      .sendVotingToken(
        user.email,
        token,
        voting.title,
        votingId,
        user.language,
        user.theme,
      )
      .catch((err) => {
        this.logger.error('Failed to send voting token', err);
      });

    // Fire-and-forget: do not block token response on audit write
    this.auditService
      .appendChain({
        action: ChainAction.VOTING_TOKEN_ISSUED,
        payload: {
          votingId,
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
          isPractice: selections.isPractice,
        },
        userId: user.id,
        votingId,
        groupId: voting.groupId,
      })
      .catch((err) => {
        this.logger.error('Failed to write audit log for token request', err);
      });

    return {
      status: 'Success',
      message: 'Voting token sent to email',
      token: token,
    }; // for tests
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
      const { optionIds, otherText, isAbstention, isPractice } = selections;

      const user = await this.usersService.findOne(userId);
      this.logger.debug(
        `Confirming vote for user ${userId} ${user.language} ${user.theme} on voting ${votingId} (practice: ${isPractice})`,
      );

      const result = await this.vote(
        votingId,
        optionIds,
        {
          id: userId,
          email: user.email,
          language: user.language,
          theme: user.theme,
        },
        rawToken,
        otherText,
        isAbstention,
        isPractice,
      );

      await this.redis.deleteSelections(userId, votingId);

      return {
        success: true,
        receipts: result.receipts,
        theme: user.theme,
        language: user.language,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message ?? 'Something went wrong.',
      };
    }
  }

  // ─── Vote ─────────────────────────────────────────────────────────────────────

  async vote(
    votingId: string,
    optionIds: string[],
    user: { id: string; email: string; language: string; theme: string },
    token: string,
    otherText?: string,
    isAbstention?: boolean,
    isPractice?: boolean,
  ) {
    const lockKey = `vote_lock:${votingId}:${user.id}`;
    let lockToken: string | null = null;

    let votingTitle!: string;
    const receipts: string[] = [];
    let tokenHashed!: string;
    let groupId!: string;
    let optionIdsToTally: string[] = [...optionIds];

    try {
      lockToken = await this.redis.acquireLock(lockKey, 15);
      if (!lockToken)
        throw new ForbiddenException('Vote submission already in progress');

      if (!isPractice) {
        const alreadyVoted = await this.redis.hasUserVoted(votingId, user.id);
        if (alreadyVoted) throw new ForbiddenException('Already participated');
      }

      // ── Token verification ───────────────────────────────────────────────
      const tokenMeta = await this.redis.verifyToken(
        'voting',
        user.id,
        votingId,
        token,
      );

      // Force practice mode if token was issued as practice
      const actualIsPractice = tokenMeta.isPractice || isPractice || false;

      tokenHashed = CryptoUtils.hashToken(token);

      const voting = await this.repo.findVotingById(votingId);
      if (!voting) throw new NotFoundException('Voting not found');
      if (voting.isFinalized)
        throw new ForbiddenException('This voting has been finalized');

      votingTitle = voting.title;
      groupId = voting.groupId;

      // ── Voting guards ────────────────────────────────────────────────────
      this.assertTiming(voting);

      const trimmedOther = otherText?.trim();
      if (trimmedOther && !voting.allowOther)
        throw new ForbiddenException(
          'This voting does not allow an "Other" answer',
        );

      const hasOther = !!trimmedOther;

      if (optionIds.length === 0 && !hasOther && !isAbstention)
        throw new BadRequestException(
          'You must select an option or provide an "Other" answer',
        );

      if (isAbstention && (optionIds.length > 0 || hasOther))
        throw new BadRequestException(
          'Conflicting vote: Abstention selected along with other options',
        );

      if (optionIds.length > 0) {
        this.assertOptionIds(voting, optionIds);
        this.assertChoiceCount(
          {
            type: voting.type as VotingType,
            minChoices: voting.minChoices,
            maxChoices: voting.maxChoices,
          },
          optionIds,
          hasOther,
        );
      }

      // ── Build hashed ballots ─────────────────────────────────────────────
      const ballotsHashed: Array<{
        optionId: string | null;
        isAbstention: boolean;
        ballotHash: string;
        tokenHashed: string;
      }> = optionIds.map((optId) => {
        const receipt = CryptoUtils.generateBallotReceipt(
          votingId,
          optId,
          tokenHashed,
        );

        receipts.push(receipt);
        return {
          optionId: optId,
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

      if (!actualIsPractice) {
        await this.repo.$transaction(async (tx) => {
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
      } else {
        this.logger.debug(
          `Bypassing DB persistence for practice vote: ${votingId} user: ${user.id}`,
        );
      }

      try {
        await this.redis.consumeToken('voting', user.id, votingId);
      } catch (err) {
        this.logger.error(
          `Failed to consume token after committed vote: ${err}`,
        );
      }

      try {
        await this.redis.performVote(
          votingId,
          optionIdsToTally,
          user.id,
          isAbstention,
          actualIsPractice,
        );

        if (!actualIsPractice) {
          await this.redis.setTemporaryReceipts(
            votingId,
            user.id,
            receipts,
            300,
          );
        }
      } catch (err) {
        this.logger.error(
          `Redis vote cache update failed for voting ${votingId}: ${err}`,
        );
      }

      if (!actualIsPractice) {
        // Fire-and-forget: audit write must not block vote response
        this.auditService
          .appendChain({
            action: ChainAction.BALLOT_CAST,
            payload: {
              ballotHashes: receipts,
              tokenHashed: tokenHashed,
              optionCount: optionIds.length,
              hasOther: !!otherText,
              isAbstention: !!isAbstention,
            },
            votingId,
            groupId,
          })
          .catch((err) => {
            this.logger.error(
              `Audit chain write failed for BALLOT_CAST voting ${votingId}: ${err}`,
            );
          });
      }

      if (!actualIsPractice) {
        // Fire-and-forget: receipt email must not block vote response
        this.mailService
          .sendVoteReceipt(
            user.email,
            votingTitle,
            votingId,
            receipts,
            user.language,
            user.theme,
          )
          .catch((err) => {
            this.logger.error(
              `Receipt email failed for user ${user.id}: ${err}`,
            );
          });
      }

      // ── Broadcast live results — fire-and-forget ──────────────────────────
      if (!actualIsPractice) {
        // Build result delta from data already in memory — zero extra DB/Redis calls
        try {
          const redisResults = await this.redis.getResults(votingId);
          const votingOptions = voting.options.map((o) => ({
            id: o.id,
            text: o.text,
            voteCount: redisResults
              ? parseInt(redisResults[o.id] ?? '0')
              : o._count?.ballots ?? 0,
          }));

          const abstentionsCount = redisResults
            ? parseInt(redisResults['ABSTENTION_COUNT'] ?? '0')
            : 0;

          const totalBallots =
            votingOptions.reduce((s, o) => s + o.voteCount, 0) + abstentionsCount;

          this.socketEmitter.emitVotingResultsDirect(votingId, {
            options: votingOptions,
            totalBallots,
            abstentionsCount,
          });
        } catch (err) {
          this.logger.error(`Direct socket emit failed for ${votingId}: ${err}`);
        }

        // Global stats still goes through queue (debounced, not latency-sensitive)
        this.broadcastGlobalStats();
      }

      return {
        participated: true,
        receipts,
        isPractice: actualIsPractice,
        proof: {
          verifyUrl: `/votings/${votingId}/verify-receipt`,
          chainUrl: `/audit/votings/audit-chain/${votingId}`,
        },
      };
    } finally {
      if (lockToken) await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  // ─── Results ──────────────────────────────────────────────────────────────────

  async getParticipationStats(votingId: string) {
    const data = await this.repo.getParticipationStats(votingId);
    // Group by 1-minute intervals for the chart
    const stats: Record<string, number> = {};
    data.forEach((p) => {
      const date = new Date(p.createdAt);
      date.setSeconds(0);
      date.setMilliseconds(0);
      const key = date.toISOString();
      stats[key] = (stats[key] || 0) + 1;
    });

    return Object.entries(stats).map(([time, votes]) => ({ time, votes }));
  }

  async getResults(
    votingId: string,
    includeRawOther = false,
    forceFresh = false,
  ): Promise<IVotingResults & { isClosed: boolean }> {
    const voting = await this.repo.findVotingById(votingId);
    if (!voting) throw new NotFoundException('Voting not found');

    const isClosed = voting.endAt ? new Date() > new Date(voting.endAt) : false;

    // If finalized, use sealed tally
    if (voting.isFinalized) {
      try {
        const sealed = await this.getSealedResult(votingId);
        if (sealed && sealed.tally) {
          const tally = sealed.tally as any;
          const options = voting.options.map((o) => ({
            id: o.id,
            text: o.text,
            isDynamic: false,
            voteCount: tally.options[o.id] || 0,
          }));
          return {
            options,
            totalBallots: sealed.totalBallots,
            isClosed,
          };
        }
      } catch (err) {
        this.logger.warn(
          `Could not fetch sealed results for finalized voting ${votingId}, falling back to live data.`,
        );
      }
    }

    const cacheKey = `results:snapshot:${votingId}`;

    if (!isClosed && !forceFresh) {
      const broadcastIntervalMs = (voting.broadcastInterval ?? 1) * 3600 * 1000;
      const lastBroadcast = voting.lastBroadcastAt
        ? new Date(voting.lastBroadcastAt)
        : new Date(voting.createdAt);
      const nextBroadcastAt = new Date(
        lastBroadcast.getTime() + broadcastIntervalMs,
      );

      const snapshot = await this.redis.getSnapshot<
        IVotingResults & { isClosed: boolean }
      >(cacheKey);

      if (new Date() < nextBroadcastAt && snapshot) {
        return snapshot;
      }

      if (new Date() >= nextBroadcastAt) {
        await this.repo.updateVoting(votingId, { lastBroadcastAt: new Date() });
      }
    }

    const [cached, rawWithCounts] = await Promise.all([
      this.redis.getResults(votingId),
      this.repo.findOptionsWithBallotCounts(votingId),
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

    const results = {
      options: staticOptions,
      totalBallots,
      abstentionsCount,
      otherTotal: voting?.allowOther ? otherTotal : undefined,
      dynamicOptions: voting?.allowOther ? dynamicOptions : undefined,
      isClosed,
    };

    // Cache snapshot
    if (!isClosed) {
      await this.redis.setSnapshot(cacheKey, results, 7200);
    }

    return results;
  }

  async getSealedResult(votingId: string) {
    const result = await this.repo.findVotingResult(votingId);
    if (!result)
      throw new NotFoundException('This voting has not been finalized yet');

    // Decrypt tally if encrypted
    if (result.tally && (result.tally as any).encrypted) {
      const decrypted = CryptoUtils.decrypt((result.tally as any).encrypted);
      try {
        result.tally = JSON.parse(decrypted);
      } catch (err) {
        this.logger.error(
          `Failed to parse decrypted tally for voting ${votingId}`,
          err,
        );
      }
    }

    return result;
  }

  // ─── Finalize ─────────────────────────────────────────────────────────────────

  async finalizeVoting(votingId: string, userId: string) {
    const voting = await this.repo.findVotingRaw(votingId);
    if (!voting) throw new NotFoundException('Voting not found');
    if (voting.isFinalized)
      throw new ConflictException('Voting is already finalized');

    if (voting.endAt && new Date() < new Date(voting.endAt)) {
      throw new ForbiddenException('Voting has not ended yet');
    }

    // Secure gate: Check audit status
    const auditStatus = await this.auditService.getAuditStatus(
      'voting',
      votingId,
    );
    if (!auditStatus.isSecure) {
      throw new ForbiddenException(
        `Cannot finalize voting: Audit chain is not secure. ${auditStatus.reason || ''}`,
      );
    }

    const options = await this.repo.findOptionsWithBallotCounts(votingId);

    const tally = {
      options: Object.fromEntries(options.map((o) => [o.id, o._count.ballots])),
    };

    const totalBallots = await this.repo.countBallotsByVoting(votingId);
    const tallyHash = CryptoUtils.generateTallyHash(tally, totalBallots);

    // Encrypt tally for storage
    const encryptedTally = {
      encrypted: CryptoUtils.encrypt(JSON.stringify(tally)),
    };

    const result = await this.repo.$transaction((tx) =>
      this.repo.finalizeVoting(
        tx,
        votingId,
        encryptedTally,
        totalBallots,
        tallyHash,
      ),
    );

    // seal the audit chain — this one stays awaited, finalize is not hot path
    try {
      await this.auditService.appendChain({
        action: ChainAction.VOTING_RESULT_SEALED,
        payload: {
          tallyHash,
          totalBallots,
          chainVerified: true,
          chainBlocksChecked: auditStatus.lastVerifiedSequence,
        },
        votingId,
        groupId: voting.groupId,
      });
    } catch (err) {
      this.logger.error(`Audit write failed for VOTING_RESULT_SEALED: ${err}`);
    }

    return { ...result, tally, chainVerified: true };
  }

  // ─── User participation status ────────────────────────────────────────────────

  async getUserVote(
    votingId: string,
    userId: string,
  ): Promise<IUserVoteStatus> {
    const participation = await this.repo.findParticipation(userId, votingId);
    if (!participation) return { participated: false };

    const receipts = await this.redis.getTemporaryReceipts(votingId, userId);
    return {
      participated: true,
      receipts: receipts || undefined,
    };
  }

  broadcastResults(votingId: string, results: IVotingResults) {
    this.gateway.emitVotingResults(votingId, results);
  }

  async broadcastGlobalStats() {
    await this.broadcastService.broadcastGlobalStats();
  }

  async broadcastLiveResults(votingId: string) {
    await this.broadcastService.broadcastVotingResults(votingId);
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
    optionIds: string[],
    hasOther: boolean,
  ) {
    const effectiveCount = optionIds.length + (hasOther ? 1 : 0);

    if (voting.type === VotingType.SINGLE_CHOICE && effectiveCount > 1)
      throw new BadRequestException(
        'This voting does not allow multiple selections',
      );

    if (
      optionIds.length > 0 &&
      optionIds.length < voting.minChoices &&
      !hasOther
    )
      throw new BadRequestException(
        `You must select at least ${voting.minChoices} option(s)`,
      );

    if (voting.maxChoices !== null && effectiveCount > voting.maxChoices)
      throw new BadRequestException(
        `You can select at most ${voting.maxChoices} option(s)`,
      );
  }

  // ─── Receipt verification ─────────────────────────────────────────────────────
  async verifyReceipt(votingId: string, hash: string | string[]) {
    const voting = await this.repo.findVotingAllowOther(votingId);
    if (!voting) throw new NotFoundException('Voting not found');
    return this.auditService.findBallotReceipt(votingId, hash, 'voting');
  }
}
