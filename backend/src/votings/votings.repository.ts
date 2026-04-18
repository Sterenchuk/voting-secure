import { Injectable } from '@nestjs/common';
import { AuditAction, VotingResult } from '@prisma/client';
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
  isOpen: true,
  isFinalized: true,
  allowOther: true,
  minChoices: true,
  maxChoices: true,
  startAt: true,
  endAt: true,
  finalizedAt: true,
  createdAt: true,
} as const;

export const SELECT_VOTING_WITH_OPTIONS = {
  ...SELECT_VOTING,
  options: { select: SELECT_OPTION },
} as const;

export const SELECT_VOTING_FOR_VOTE = {
  id: true,
  isOpen: true,
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

// FreeformBallot has no createdAt — same anonymity invariant
export const SELECT_FREEFORM = {
  id: true,
  votingId: true,
  text: true,
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

  async findVotings(where: IVotingWhereInput) {
    return this.db.voting.findMany({
      where: { ...where, deletedAt: null },
      select: SELECT_VOTING_WITH_OPTIONS,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findVotingById(id: string) {
    return this.db.voting.findUnique({
      where: { id, deletedAt: null },
      select: {
        ...SELECT_VOTING,
        options: { select: SELECT_OPTION_WITH_VOTE_COUNT },
      },
    });
  }

  async findVotingRaw(id: string) {
    return this.db.voting.findUnique({
      where: { id, deletedAt: null },
      include: {
        group: { include: { users: true } },
      },
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

  async findOptionsByVoting(votingId: string) {
    return this.db.option.findMany({
      where: { votingId },
      select: SELECT_OPTION,
    });
  }

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

  // ─── Ballots ───────────────────────────────────────────────────────────────

  async createBallotsTx(
    tx: PrismaTx,
    votingId: string,
    ballots: { optionId: string; ballotHash: string }[],
  ) {
    return Promise.all(
      ballots.map(({ optionId, ballotHash }) =>
        tx.ballot.create({
          data: { votingId, optionId, ballotHash },
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

  // ─── Freeform ballots ─────────────────────────────────────────────────────────

  async findFreeformBallotsByVoting(votingId: string) {
    return this.db.freeformBallot.findMany({
      where: { votingId },
      select: SELECT_FREEFORM,
    });
  }

  async countFreeformBallotsByVoting(votingId: string) {
    return this.db.freeformBallot.count({
      where: { votingId },
    });
  }

  async createFreeformBallotTx(
    tx: PrismaTx,
    data: { votingId: string; text: string; ballotHash: string },
  ) {
    return tx.freeformBallot.create({
      data,
      select: SELECT_FREEFORM,
    });
  }

  // ─── Participation ──────────────────────────────────────────────────────────

  async findParticipation(userId: string, votingId: string) {
    return this.db.voteParticipation.findUnique({
      where: { userId_votingId: { userId, votingId } },
      select: { id: true, createdAt: true },
    });
  }

  async createParticipationTx(tx: PrismaTx, userId: string, votingId: string) {
    return tx.voteParticipation.create({
      data: { userId, votingId },
      select: { id: true, createdAt: true },
    });
  }

  // ─── Membership ─────────────────────────────────────────────────────────────

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
      select: { id: true, votingId: true, tallyHash: true, sealedAt: true },
    });
  }

  // ─── Voting tokens (Rec §47) ──────────────────────────────────────────────────

  async findVotingToken(tx: PrismaTx, userId: string, votingId: string) {
    return tx.votingToken.findUnique({
      where: { userId_votingId: { userId, votingId } },
      select: { id: true, tokenHash: true, used: true, expiresAt: true },
    });
  }

  async consumeVotingToken(tx: PrismaTx, tokenId: string) {
    return tx.votingToken.update({
      where: { id: tokenId },
      data: { used: true },
      select: { id: true },
    });
  }

  async createVotingToken(data: {
    userId: string;
    votingId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.db.votingToken.create({
      data,
      select: { id: true, expiresAt: true },
    });
  }

  // ─── Sealed result (Rec §56) ──────────────────────────────────────────────────

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

  // ─── Audit log (Rec §52) ──────────────────────────────────────────────────────

  async createAuditLog(data: {
    action: AuditAction;
    payload: object;
    userId?: string;
    votingId?: string;
    surveyId?: string;
  }) {
    return this.db.auditLog.create({
      data: { ...data, payload: data.payload as any },
    });
  }

  // ─── Transaction wrapper ──────────────────────────────────────────────────────

  async $transaction<T>(fn: (tx: PrismaTx) => Promise<T>): Promise<T> {
    return this.db.$transaction(fn);
  }
}
