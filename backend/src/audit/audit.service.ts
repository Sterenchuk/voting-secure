import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';

import { AuditChain, AuditChainDocumentHydrated } from './schemas/audit-chain.schema';
import { AuditSecurity } from './schemas/audit-security.schema';
import {
  AuditChainContext,
  AuditSecurityContext,
  AuditChainDocument,
  VerifyResult,
  ScopedVerifyResult,
  ChainAction,
} from './types/audit.types';
import { RedisVotingService } from '../redis/redis.service';

// ─── Serialisation ────────────────────────────────────────────────────────────

function deterministicSerialize(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return '[' + value.map(deterministicSerialize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const sorted = Object.keys(value as object)
      .sort()
      .map(
        (k) =>
          `${k}:${deterministicSerialize((value as Record<string, unknown>)[k])}`,
      );
    return '{' + sorted.join(',') + '}';
  }
  return String(value);
}

// ─── Hash ─────────────────────────────────────────────────────────────────────

function computeHash(params: {
  prevHash: string;
  sequence: number;
  groupSequence?: number | null;
  votingSequence?: number | null;
  surveySequence?: number | null;
  groupPrevHash?: string | null;
  votingPrevHash?: string | null;
  surveyPrevHash?: string | null;
  action: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}): string {
  const data = [
    params.prevHash,
    String(params.sequence),
    params.groupSequence != null ? String(params.groupSequence) : '',
    params.votingSequence != null ? String(params.votingSequence) : '',
    params.surveySequence != null ? String(params.surveySequence) : '',
    params.groupPrevHash ?? '',
    params.votingPrevHash ?? '',
    params.surveyPrevHash ?? '',
    params.action,
    deterministicSerialize(params.payload),
    params.createdAt.toISOString(),
  ].join('|');

  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditChain.name)
    private readonly chainModel: Model<AuditChain>,

    @InjectModel(AuditSecurity.name)
    private readonly securityModel: Model<AuditSecurity>,

    private readonly redis: RedisVotingService,
  ) {}

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  async onModuleInit() {
    const last = await this.chainModel
      .findOne()
      .sort({ sequence: -1 })
      .select({ sequence: 1 })
      .lean();

    if (last) {
      // Set Redis counter if it doesn't exist to ensure continuity after Redis reset
      // We use ioredis directly via the service to access 'set' with 'NX'
      const client = (this.redis as any).redis;
      await client.set('audit_seq:global', (last as any).sequence, 'NX');
      this.logger.log(`audit_seq:global initialised to ${(last as any).sequence}`);
    }
  }

  private async getPrevHash(
    scope: 'global' | 'group' | 'voting' | 'survey',
    scopeId: string | null,
  ): Promise<string> {
    const filter: Record<string, any> = {};
    let sortField = 'sequence';

    if (scope !== 'global' && scopeId) {
      filter[`${scope}Id`] = scopeId;
      filter[`${scope}Sequence`] = { $ne: null };
      sortField = `${scope}Sequence`;
    }

    const last = await this.chainModel
      .findOne(filter)
      .sort({ [sortField]: -1 })
      .select({ hash: 1 })
      .lean();

    if (!last) {
      return scopeId ? `GENESIS_${scope.toUpperCase()}_${scopeId}` : 'GENESIS';
    }
    return (last as any).hash;
  }

  async getVotingChain(votingId: string) {
    return this.chainModel
      .find({ votingId })
      .sort({ votingSequence: 1 })
      .select({
        sequence: 1,
        votingSequence: 1,
        action: 1,
        payload: 1,
        hash: 1,
        prevHash: 1,
        votingPrevHash: 1,
        createdAt: 1,
      })
      .lean();
  }

  // ── Public: append to chain ───────────────────────────────────────────────
  async appendChain(ctx: AuditChainContext): Promise<void> {
    try {
      // 1. Fetch sequence numbers atomically from Redis
      const [globalSeq, groupSeq, votingSeq, surveySeq] = await Promise.all([
        this.redis.nextGlobalSequence(),
        ctx.groupId ? this.redis.nextGroupSequence(ctx.groupId) : Promise.resolve(null),
        ctx.votingId ? this.redis.nextVotingSequence(ctx.votingId) : Promise.resolve(null),
        ctx.surveyId ? this.redis.nextSurveySequence(ctx.surveyId) : Promise.resolve(null),
      ]);

      // 2. Fetch previous hashes from MongoDB
      const [globalPrev, groupPrev, votingPrev, surveyPrev] = await Promise.all([
        this.getPrevHash('global', null),
        ctx.groupId ? this.getPrevHash('group', ctx.groupId) : Promise.resolve(null),
        ctx.votingId ? this.getPrevHash('voting', ctx.votingId) : Promise.resolve(null),
        ctx.surveyId ? this.getPrevHash('survey', ctx.surveyId) : Promise.resolve(null),
      ]);

      const createdAt = new Date();

      const hash = computeHash({
        prevHash: globalPrev,
        sequence: globalSeq,
        groupSequence: groupSeq,
        votingSequence: votingSeq,
        surveySequence: surveySeq,
        groupPrevHash: groupPrev,
        votingPrevHash: votingPrev,
        surveyPrevHash: surveyPrev,
        action: ctx.action,
        payload: ctx.payload,
        createdAt,
      });

      await this.chainModel.create({
        sequence: globalSeq,
        groupSequence: groupSeq,
        votingSequence: votingSeq,
        surveySequence: surveySeq,
        action: ctx.action,
        payload: ctx.payload,
        userId: ctx.userId ?? null,
        groupId: ctx.groupId ?? null,
        votingId: ctx.votingId ?? null,
        surveyId: ctx.surveyId ?? null,
        createdAt,
        prevHash: globalPrev,
        groupPrevHash: groupPrev,
        votingPrevHash: votingPrev,
        surveyPrevHash: surveyPrev,
        hash,
      });
    } catch (err) {
      this.logger.error('Failed to append audit chain entry', err);
    }
  }

  async appendSecurity(ctx: AuditSecurityContext): Promise<void> {
    try {
      await this.securityModel.create({
        action: ctx.action,
        payload: ctx.payload,
        userId: ctx.userId ?? null,
        createdAt: new Date(),
      });
    } catch (err) {
      this.logger.error('Failed to append audit security entry', err);
    }
  }

  // ── Public: verify chain ─────────────────────────────────────────────────

  async findBallotReceipt(
    votingId: string,
    hash: string,
  ): Promise<{
    found: boolean;
    sequence?: number;
    blockHash?: string;
    prevHash?: string;
  }> {
    const doc = await this.chainModel
      .findOne({
        votingId,
        action: ChainAction.BALLOT_CAST,
        'payload.ballotHashes': hash,
      })
      .select({ sequence: 1, hash: 1, prevHash: 1 })
      .lean();

    if (!doc) return { found: false };

    return {
      found: true,
      sequence: (doc as any).sequence,
      blockHash: (doc as any).hash,
      prevHash: (doc as any).prevHash,
    };
  }

  /**
   * Verifies the hash chain.
   *
   * @param groupId  When provided, only entries for that group are verified
   *                 (group admin/owner scope). When null, the full chain is
   *                 walked (platform admin scope).
   *
   * NOTE: For full-chain verification the entire collection is streamed in
   * sequence order. On very large datasets consider running this as a
   * background job rather than a synchronous HTTP response.
   */
  async verifyChain(groupId?: string | null): Promise<VerifyResult> {
    const filter = groupId ? { groupId } : {};

    const cursor = this.chainModel
      .find(filter)
      .sort({ sequence: 1 })
      .select({
        sequence: 1,
        groupSequence: 1,
        votingSequence: 1,
        surveySequence: 1,
        action: 1,
        payload: 1,
        createdAt: 1,
        prevHash: 1,
        groupPrevHash: 1,
        votingPrevHash: 1,
        surveyPrevHash: 1,
        hash: 1,
      })
      .lean()
      .cursor();

    let totalChecked = 0;
    let expectedPrevHash = groupId ? null : 'GENESIS';
    let prevSequence: number | null = null;

    for await (const raw of cursor) {
      const doc = raw as any;
      totalChecked++;

      // ── Gap detection (deletion) ───────────────────────────────────────────
      if (
        prevSequence !== null &&
        doc.sequence !== prevSequence + 1 &&
        !groupId
      ) {
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.sequence,
          reason: `Sequence gap: expected ${prevSequence + 1}, got ${doc.sequence}. Possible deletion.`,
        };
      }

      // ── Hash integrity ────────────────────────────────────────────────────
      const expected = computeHash({
        prevHash: doc.prevHash,
        sequence: doc.sequence,
        groupSequence: doc.groupSequence,
        votingSequence: doc.votingSequence,
        surveySequence: doc.surveySequence,
        groupPrevHash: doc.groupPrevHash,
        votingPrevHash: doc.votingPrevHash,
        surveyPrevHash: doc.surveyPrevHash,
        action: doc.action,
        payload: doc.payload,
        createdAt: new Date(doc.createdAt),
      });

      if (expected !== doc.hash) {
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.sequence,
          reason: `Hash mismatch at sequence ${doc.sequence}. Entry has been tampered.`,
        };
      }

      // ── Chain link integrity (full chain only) ────────────────────────────
      if (
        !groupId &&
        expectedPrevHash !== null &&
        doc.prevHash !== expectedPrevHash
      ) {
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.sequence,
          reason: `prevHash mismatch at sequence ${doc.sequence}. Chain link broken.`,
        };
      }

      expectedPrevHash = doc.hash;
      prevSequence = doc.sequence;
    }

    return {
      valid: true,
      totalChecked,
      brokenAt: null,
      reason: null,
    };
  }

  // ── Verify voting scope ───────────────────────────────────────────────────────
  async verifyVotingChain(votingId: string): Promise<ScopedVerifyResult> {
    const cursor = this.chainModel
      .find({ votingId, votingSequence: { $ne: null } })
      .sort({ votingSequence: 1 })
      .select({
        sequence: 1,
        groupSequence: 1,
        votingSequence: 1,
        surveySequence: 1,
        action: 1,
        payload: 1,
        createdAt: 1,
        prevHash: 1,
        groupPrevHash: 1,
        votingPrevHash: 1,
        surveyPrevHash: 1,
        hash: 1,
      })
      .lean()
      .cursor();

    let totalChecked = 0;
    let expectedPrevHash: string | null = null;
    let prevSequence: number | null = null;

    for await (const raw of cursor) {
      const doc = raw as any;
      totalChecked++;

      // gap detection — voting sequence must be contiguous
      if (prevSequence !== null && doc.votingSequence !== prevSequence + 1) {
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.votingSequence,
          reason: `Voting sequence gap: expected ${prevSequence + 1}, got ${doc.votingSequence}. Possible deletion.`,
          scope: 'voting',
          scopeId: votingId,
        };
      }

      // hash integrity — recompute and compare
      const expected = computeHash({
        prevHash: doc.prevHash,
        sequence: doc.sequence,
        groupSequence: doc.groupSequence,
        votingSequence: doc.votingSequence,
        surveySequence: doc.surveySequence,
        groupPrevHash: doc.groupPrevHash,
        votingPrevHash: doc.votingPrevHash,
        surveyPrevHash: doc.surveyPrevHash,
        action: doc.action,
        payload: doc.payload,
        createdAt: new Date(doc.createdAt),
      });

      if (expected !== doc.hash) {
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.votingSequence,
          reason: `Hash mismatch at votingSequence ${doc.votingSequence}. Entry tampered.`,
          scope: 'voting',
          scopeId: votingId,
        };
      }

      // chain link integrity
      if (
        expectedPrevHash !== null &&
        doc.votingPrevHash !== expectedPrevHash
      ) {
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.votingSequence,
          reason: `votingPrevHash mismatch at sequence ${doc.votingSequence}. Chain link broken.`,
          scope: 'voting',
          scopeId: votingId,
        };
      }

      expectedPrevHash = doc.hash;
      prevSequence = doc.votingSequence;
    }

    return {
      valid: true,
      totalChecked,
      brokenAt: null,
      reason: null,
      scope: 'voting',
      scopeId: votingId,
    };
  }

  // ── Verify group scope ───────────────────────────────────────────────────────
  async verifyGroupChain(groupId: string): Promise<ScopedVerifyResult> {
    const cursor = this.chainModel
      .find({ groupId, groupSequence: { $ne: null } })
      .sort({ groupSequence: 1 })
      .select({
        sequence: 1,
        groupSequence: 1,
        votingSequence: 1,
        surveySequence: 1,
        action: 1,
        payload: 1,
        createdAt: 1,
        prevHash: 1,
        groupPrevHash: 1,
        votingPrevHash: 1,
        surveyPrevHash: 1,
        hash: 1,
      })
      .lean()
      .cursor();

    let totalChecked = 0;
    let expectedPrevHash: string | null = null;
    let prevSequence: number | null = null;

    for await (const raw of cursor) {
      const doc = raw as any;
      totalChecked++;

      // gap detection — group sequence must be contiguous
      if (prevSequence !== null && doc.groupSequence !== prevSequence + 1) {
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.groupSequence,
          reason: `Group sequence gap: expected ${prevSequence + 1}, got ${doc.groupSequence}. Possible deletion.`,
          scope: 'group',
          scopeId: groupId,
        };
      }

      // hash integrity — recompute and compare
      const expected = computeHash({
        prevHash: doc.prevHash,
        sequence: doc.sequence,
        groupSequence: doc.groupSequence,
        votingSequence: doc.votingSequence,
        surveySequence: doc.surveySequence,
        groupPrevHash: doc.groupPrevHash,
        votingPrevHash: doc.votingPrevHash,
        surveyPrevHash: doc.surveyPrevHash,
        action: doc.action,
        payload: doc.payload,
        createdAt: new Date(doc.createdAt),
      });

      if (expected !== doc.hash) {
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.groupSequence,
          reason: `Hash mismatch at groupSequence ${doc.groupSequence}. Entry tampered.`,
          scope: 'group',
          scopeId: groupId,
        };
      }

      // chain link integrity
      if (expectedPrevHash !== null && doc.groupPrevHash !== expectedPrevHash) {
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.groupSequence,
          reason: `groupPrevHash mismatch at sequence ${doc.groupSequence}. Chain link broken.`,
          scope: 'group',
          scopeId: groupId,
        };
      }

      expectedPrevHash = doc.hash;
      prevSequence = doc.groupSequence;
    }

    return {
      valid: true,
      totalChecked,
      brokenAt: null,
      reason: null,
      scope: 'group',
      scopeId: groupId,
    };
  }

  // ── Verify survey scope ───────────────────────────────────────────────────────
  async verifySurveyChain(surveyId: string): Promise<ScopedVerifyResult> {
    const cursor = this.chainModel
      .find({ surveyId, surveySequence: { $ne: null } })
      .sort({ surveySequence: 1 })
      .select({
        sequence: 1,
        groupSequence: 1,
        votingSequence: 1,
        surveySequence: 1,
        action: 1,
        payload: 1,
        createdAt: 1,
        prevHash: 1,
        groupPrevHash: 1,
        votingPrevHash: 1,
        surveyPrevHash: 1,
        hash: 1,
      })
      .lean()
      .cursor();

    let totalChecked = 0;
    let expectedPrevHash: string | null = null;
    let prevSequence: number | null = null;

    for await (const raw of cursor) {
      const doc = raw as any;
      totalChecked++;

      // gap detection — survey sequence must be contiguous
      if (prevSequence !== null && doc.surveySequence !== prevSequence + 1) {
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.surveySequence,
          reason: `Survey sequence gap: expected ${prevSequence + 1}, got ${doc.surveySequence}. Possible deletion.`,
          scope: 'survey',
          scopeId: surveyId,
        };
      }

      // hash integrity — recompute and compare
      const expected = computeHash({
        prevHash: doc.prevHash,
        sequence: doc.sequence,
        groupSequence: doc.groupSequence,
        votingSequence: doc.votingSequence,
        surveySequence: doc.surveySequence,
        groupPrevHash: doc.groupPrevHash,
        votingPrevHash: doc.votingPrevHash,
        surveyPrevHash: doc.surveyPrevHash,
        action: doc.action,
        payload: doc.payload,
        createdAt: new Date(doc.createdAt),
      });

      if (expected !== doc.hash) {
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.surveySequence,
          reason: `Hash mismatch at surveySequence ${doc.surveySequence}. Entry tampered.`,
          scope: 'survey',
          scopeId: surveyId,
        };
      }

      // chain link integrity
      if (
        expectedPrevHash !== null &&
        doc.surveyPrevHash !== expectedPrevHash
      ) {
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.surveySequence,
          reason: `surveyPrevHash mismatch at sequence ${doc.surveySequence}. Chain link broken.`,
          scope: 'survey',
          scopeId: surveyId,
        };
      }

      expectedPrevHash = doc.hash;
      prevSequence = doc.surveySequence;
    }

    return {
      valid: true,
      totalChecked,
      brokenAt: null,
      reason: null,
      scope: 'survey',
      scopeId: surveyId,
    };
  }
}
