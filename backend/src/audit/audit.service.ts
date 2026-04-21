import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';

import { AuditChain } from './schemas/audit-chain.schema';
import { AuditSecurity } from './schemas/audit-security.schema';
import {
  AuditChainContext,
  AuditSecurityContext,
  AuditChainDocument,
  VerifyResult,
} from './types/audit.types';

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
  action: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}): string {
  const data =
    params.prevHash +
    String(params.sequence) +
    params.action +
    deterministicSerialize(params.payload) +
    params.createdAt.toISOString();

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
  ) {}

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  async onModuleInit() {
    const count = await this.chainModel.countDocuments();
    if (count === 0) {
      this.logger.log('audit_chain is empty — no genesis block needed yet.');
    }
  }

  private async getChainTip(): Promise<{
    nextSequence: number;
    prevHash: string;
  }> {
    const last = await this.chainModel
      .findOne()
      .sort({ sequence: -1 })
      .select({ sequence: 1, hash: 1 })
      .lean()
      .exec();

    if (!last) {
      return { nextSequence: 1, prevHash: 'GENESIS' };
    }

    return {
      nextSequence: (last as AuditChainDocument).sequence + 1,
      prevHash: (last as AuditChainDocument).hash,
    };
  }

  // ── Public: append to chain ───────────────────────────────────────────────
  async appendChain(ctx: AuditChainContext): Promise<void> {
    try {
      const { nextSequence, prevHash } = await this.getChainTip();
      const createdAt = new Date();

      const hash = computeHash({
        prevHash,
        sequence: nextSequence,
        action: ctx.action,
        payload: ctx.payload,
        createdAt,
      });

      await this.chainModel.create({
        sequence: nextSequence,
        action: ctx.action,
        payload: ctx.payload,
        userId: ctx.userId ?? null,
        groupId: ctx.groupId ?? null,
        votingId: ctx.votingId ?? null,
        surveyId: ctx.surveyId ?? null,
        createdAt,
        prevHash,
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
        action: 1,
        payload: 1,
        createdAt: 1,
        prevHash: 1,
        hash: 1,
      })
      .lean()
      .cursor();

    let totalChecked = 0;
    let expectedPrevHash = groupId ? null : 'GENESIS';
    let prevSequence: number | null = null;

    for await (const raw of cursor) {
      const doc = raw as unknown as AuditChainDocument;
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
}
