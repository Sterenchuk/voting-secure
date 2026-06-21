import { Injectable } from '@nestjs/common';
import { DatabaseService, PrismaTx } from '../database/database.service';
import {
  ICreateVotingData,
  IUpdateVotingData,
  IVotingWhereInput,
} from './types/voting.types';

// ─── Select constants ─────────────────────────────────────────────────────────

export const SELECT_OPTION = {
  id: true,
  text: true,
  votingId: true,
  isDynamic: true,
} as const;

export const SELECT_OPTION_WITH_VOTE_COUNT = {
  ...SELECT_OPTION,
  _count: { select: { ballots: true } },
} as const;

export const SELECT_VOTING = {
  id: true,
  title: true,
  description: true,
  groupId: true,
  type: true,
  isPublic: true,
  isFinalized: true,
  allowOther: true,
  allowAbstain: true,
  minChoices: true,
  maxChoices: true,
  startAt: true,
  endAt: true,
  finalizedAt: true,
  createdAt: true,
  broadcastInterval: true,
  lastBroadcastAt: true,
} as const;

export const SELECT_VOTING_WITH_OPTIONS = {
  ...SELECT_VOTING,
  options: { select: SELECT_OPTION },
} as const;

export const SELECT_VOTING_FOR_VOTE = {
  id: true,
  title: true,
  isPublic: true,
  isFinalized: true,
  groupId: true,
  type: true,
  allowOther: true,
  minChoices: true,
  maxChoices: true,
  startAt: true,
  endAt: true,
  options: { select: { id: true } },
} as const;

// Ballot has no createdAt — intentional anonymity invariant (Rec §26)
export const SELECT_BALLOT = {
  id: true,
  votingId: true,
  optionId: true,
  ballotHash: true,
} as const;

// ─── Repository ───────────────────────────────────────────────────────────────

@Injectable()
export class VotingsRepository {
  constructor(private readonly db: DatabaseService) {}

  // ─── Voting CRUD ──────────────────────────────────────────────────────────────

  async createVoting(creatorId: string, data: ICreateVotingData) {
    const { options, ...votingFields } = data;
    return this.db.voting.create({
      data: {
        ...votingFields,
        creatorId,
        options: { create: options.map((text) => ({ text })) },
      },
      select: SELECT_VOTING_WITH_OPTIONS,
    });
  }

  async findVotings(
    where: IVotingWhereInput,
    userId?: string,
    isAdmin = false,
    isAuditor = false,
  ) {
    const visibilityFilter =
      isAdmin || isAuditor || !userId
        ? {}
        : {
            OR: [{ isPublic: true }, { group: { users: { some: { userId } } } }],
          };

    const votings = await this.db.voting.findMany({
      where: {
        ...where,
        deletedAt: null,
        ...visibilityFilter,
      },
      select: {
        ...SELECT_VOTING,
        options: { select: SELECT_OPTION_WITH_VOTE_COUNT },
        _count: {
          select: { ballots: true, participations: true },
        },
        participations: userId
          ? {
              where: { userId },
              select: { id: true },
            }
          : undefined,
        group: {
          select: {
            id: true,
            users: userId
              ? {
                  where: { userId },
                  select: { role: true },
                }
              : false,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return votings.map((v) => ({
      ...v,
      userGroupRole: (v as any).group?.users?.[0]?.role,
    }));
  }

  async findVotingById(
    id: string,
    userId?: string,
    isAdmin = false,
    isAuditor = false,
  ) {
    const visibilityFilter =
      isAdmin || isAuditor || !userId
        ? {}
        : {
            OR: [{ isPublic: true }, { group: { users: { some: { userId } } } }],
          };

    const voting = await this.db.voting.findFirst({
      where: {
        id,
        deletedAt: null,
        ...visibilityFilter,
      },
      select: {
        ...SELECT_VOTING,
        options: { select: SELECT_OPTION_WITH_VOTE_COUNT },
        _count: {
          select: { participations: true },
        },
        group: {
          select: {
            id: true,
            users: userId
              ? {
                  where: { userId },
                  select: { role: true },
                }
              : false,
          },
        },
      },
    });

    if (!voting) return null;

    return {
      ...voting,
      userGroupRole: (voting as any).group?.users?.[0]?.role,
    };
  }

  async findVotingRaw(id: string) {
    return this.db.voting.findUnique({
      where: { id, deletedAt: null },
      include: {
        group: { include: { users: true } },
      },
    });
  }

  async findVotingAllowOther(id: string) {
    return this.db.voting.findUnique({
      where: { id, deletedAt: null },
      select: { allowOther: true },
    });
  }

  async findVotingForVote(tx: PrismaTx, id: string) {
    return tx.voting.findUnique({
      where: { id, deletedAt: null },
      select: SELECT_VOTING_FOR_VOTE,
    });
  }

  async updateVoting(id: string, data: IUpdateVotingData) {
    return this.db.voting.update({
      where: { id },
      data,
      select: SELECT_VOTING_WITH_OPTIONS,
    });
  }

  async softDeleteVoting(id: string) {
    return this.db.voting.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Options ──────────────────────────────────────────────────────────────────

  async findOptionsWithBallotCounts(votingId: string) {
    return this.db.option.findMany({
      where: { votingId },
      select: SELECT_OPTION_WITH_VOTE_COUNT,
    });
  }

  async updateOption(id: string, text: string) {
    return this.db.option.update({
      where: { id },
      data: { text },
      select: SELECT_OPTION,
    });
  }

  // ─── Ballots ──────────────────────────────────────────────────────────────────

  async createBallotsTx(
    tx: PrismaTx,
    votingId: string,
    ballots: { optionId: string | null; isAbstention: boolean; ballotHash: string; tokenHashed: string }[],
  ) {
    return Promise.all(
      ballots.map(({ optionId, isAbstention, ballotHash, tokenHashed }) =>
        tx.ballot.create({
          data: { votingId, optionId, isAbstention, ballotHash, tokenHashed },
          select: SELECT_BALLOT,
        }),
      ),
    );
  }

  async countBallotsByVoting(votingId: string) {
    return this.db.ballot.count({
      where: { votingId },
    });
  }

  async countAbstentions(votingId: string) {
    return this.db.ballot.count({
      where: { votingId, isAbstention: true },
    });
  }

  // ─── Participation ────────────────────────────────────────────────────────────

  async findParticipation(userId: string, votingId: string) {
    return this.db.voteParticipation.findUnique({
      where: { userId_votingId: { userId, votingId } },
      select: { id: true, createdAt: true },
    });
  }

  async getParticipationStats(votingId: string) {
    return this.db.voteParticipation.findMany({
      where: { votingId },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createParticipationTx(tx: PrismaTx, userId: string, votingId: string) {
    return tx.voteParticipation.create({
      data: { userId, votingId },
      select: { id: true, createdAt: true },
    });
  }

  // ─── Finalize ─────────────────────────────────────────────────────────────────

  async finalizeVoting(
    tx: PrismaTx,
    votingId: string,
    tally: any,
    totalBallots: number,
    tallyHash: string,
  ) {
    const finalizedAt = new Date();
    await tx.voting.update({
      where: { id: votingId },
      data: { isFinalized: true, finalizedAt },
    });

    return tx.votingResult.create({
      data: {
        votingId,
        tally,
        totalBallots,
        tallyHash,
        sealedAt: finalizedAt,
      },
      select: {
        id: true,
        votingId: true,
        tallyHash: true,
        totalBallots: true,
        sealedAt: true,
      },
    });
  }

  async findVotingResult(votingId: string) {
    return this.db.votingResult.findUnique({
      where: { votingId },
      select: {
        tally: true,
        totalBallots: true,
        tallyHash: true,
        sealedAt: true,
      },
    });
  }

  async getGlobalStats() {
    const [totalVotings, totalBallots] = await Promise.all([
      this.db.voting.count({ where: { deletedAt: null } }),
      this.db.ballot.count(),
    ]);
    return { totalVotings, totalBallots };
  }

  // ─── Transaction wrapper ──────────────────────────────────────────────────────

  async $transaction<T>(fn: (tx: PrismaTx) => Promise<T>): Promise<T> {
    return this.db.$transaction(fn);
  }
}
