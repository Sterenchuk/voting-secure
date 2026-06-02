import { Injectable, Logger, OnModuleInit, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';

import {
  AuditChain,
  AuditChainDocumentHydrated,
} from './schemas/audit-chain.schema';
import { AuditSecurity } from './schemas/audit-security.schema';
import { AuditVerification } from './schemas/audit-verification.schema';
import { AuditCheckpoint } from './schemas/audit-checkpoint.schema';
import {
  AuditChainContext,
  AuditSecurityContext,
  AuditChainDocument,
  VerifyResult,
  ScopedVerifyResult,
  ChainAction,
} from './types/audit.types';
import { RedisVotingService } from '../redis/redis.service';
import { AuditVerificationJob } from './schemas/audit-verification-job.schema';

// ─── Constants ────────────────────────────────────────────────────────────────

if (!process.env.GENESIS_SEED) {
  console.warn(
    'WARNING: GENESIS_SEED environment variable is not set! This is critical for audit chain integrity. Please set a strong, unique seed value in production.',
  );
}
const GENESIS_SEED = process.env.GENESIS_SEED || 'GENESIS_SEED_NOT_SET';

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

    @InjectModel(AuditVerification.name)
    private readonly verificationModel: Model<AuditVerification>,

    @InjectModel(AuditVerificationJob.name)
    private readonly verificationJobModel: Model<AuditVerificationJob>,

    @InjectModel(AuditCheckpoint.name)
    private readonly checkpointModel: Model<AuditCheckpoint>,

    private readonly redis: RedisVotingService,
  ) {}

  // ─── Persistence: Verification Marker ───────────────────────────────────────

  async setLastVerifiedSequence(
    scope: 'global' | 'group' | 'voting' | 'survey',
    scopeId: string | null,
    sequence: number,
    isFullVerification = false,
  ): Promise<void> {
    const update: any = {
      lastVerifiedSequence: sequence,
      updatedAt: new Date(),
    };

    if (isFullVerification) {
      update.lastFullVerificationAt = new Date();
    }

    await this.verificationModel.findOneAndUpdate(
      { scope, scopeId },
      { $set: update },
      { upsert: true, new: true },
    );
  }

  async getLastVerifiedSequence(
    scope: 'global' | 'group' | 'voting' | 'survey',
    scopeId: string | null,
  ): Promise<number | null> {
    const doc = await this.verificationModel.findOne({ scope, scopeId }).lean();
    return doc ? doc.lastVerifiedSequence : null;
  }

  async getAuditStatus(
    scope: 'global' | 'group' | 'voting' | 'survey',
    scopeId: string | null,
  ) {
    const doc = await this.verificationModel.findOne({ scope, scopeId }).lean();
    
    // Get the current max sequence for this scope
    const filter: any = {};
    let seqField = 'sequence';
    if (scope !== 'global' && scopeId) {
      filter[`${scope}Id`] = scopeId;
      filter[`${scope}Sequence`] = { $ne: null };
      seqField = `${scope}Sequence`;
    }

    const lastBlock = await this.chainModel
      .findOne(filter)
      .sort({ [seqField]: -1 })
      .select({ [seqField]: 1 })
      .lean();

    const maxSequence = lastBlock ? (lastBlock as any)[seqField] : 0;
    const lastVerified = doc ? doc.lastVerifiedSequence : 0;
    const lastFullVerify = doc ? (doc as any).lastFullVerificationAt : null;
    
    // Secure logic:
    // 1. Full verification was done within the last 24 hours.
    // 2. All blocks up to the current max sequence have been verified.
    const now = new Date();
    const isWithin24h = lastFullVerify && (now.getTime() - new Date(lastFullVerify).getTime()) < 24 * 3600 * 1000;
    const isUpToDate = lastVerified >= maxSequence;

    return {
      scope,
      scopeId,
      lastVerifiedSequence: lastVerified,
      maxSequence,
      lastFullVerificationAt: lastFullVerify,
      updatedAt: doc ? (doc as any).updatedAt : null,
      isSecure: !!(isWithin24h && isUpToDate),
      reason: !isWithin24h ? 'Full verification required (over 24h since last scan)' : (!isUpToDate ? 'Incremental verification required (new blocks found)' : null),
    };
  }

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  async onModuleInit() {
    if (!GENESIS_SEED) {
      this.logger.error(
        'CRITICAL: GENESIS_SEED environment variable is not set! Audit chain integrity is at risk.',
      );
    }

    const last = await this.chainModel
      .findOne()
      .sort({ sequence: -1 })
      .select({ sequence: 1 })
      .lean();

    if (last) {
      const client = (this.redis as any).redis;
      await client.set('audit_seq:global', (last as any).sequence, 'NX');
      this.logger.log(
        `audit_seq:global initialised to ${(last as any).sequence}`,
      );
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
      const seedData = scopeId
        ? `${GENESIS_SEED}:${scope}:${scopeId}`
        : GENESIS_SEED;
      return crypto.createHash('sha256').update(seedData, 'utf8').digest('hex');
    }
    return (last as any).hash;
  }

  async getVotingChain(
    votingId: string,
    page: number = 1,
    limit: number = 50,
    filters?: { hash?: string; sequence?: string; action?: string },
  ) {
    const filter: any = { votingId, votingSequence: { $ne: null } };

    if (filters?.hash) filter.hash = filters.hash;
    if (filters?.sequence) filter.votingSequence = Number(filters.sequence);
    if (filters?.action)
      filter.action = { $regex: filters.action, $options: 'i' };

    const [records, totalCount] = await Promise.all([
      this.chainModel
        .find(filter)
        .sort({ votingSequence: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
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
        .lean(),
      this.chainModel.countDocuments(filter),
    ]);
    return { records, totalCount, page, limit };
  }

  async getSurveyChain(
    surveyId: string,
    page: number = 1,
    limit: number = 50,
    filters?: { hash?: string; sequence?: string; action?: string },
  ) {
    const filter: any = { surveyId, surveySequence: { $ne: null } };

    if (filters?.hash) filter.hash = filters.hash;
    if (filters?.sequence) filter.surveySequence = Number(filters.sequence);
    if (filters?.action)
      filter.action = { $regex: filters.action, $options: 'i' };

    const [records, totalCount] = await Promise.all([
      this.chainModel
        .find(filter)
        .sort({ surveySequence: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select({
          sequence: 1,
          surveySequence: 1,
          action: 1,
          payload: 1,
          hash: 1,
          prevHash: 1,
          surveyPrevHash: 1,
          createdAt: 1,
        })
        .lean(),
      this.chainModel.countDocuments(filter),
    ]);
    return { records, totalCount, page, limit };
  }

  async searchChain(params: {
    hash?: string;
    sequence?: number;
    action?: string;
    votingId?: string;
    surveyId?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};
    if (params.hash) filter.hash = params.hash;
    if (params.sequence) filter.sequence = Number(params.sequence);
    if (params.action) filter.action = { $regex: params.action, $options: 'i' };
    if (params.votingId) filter.votingId = params.votingId;
    if (params.surveyId) filter.surveyId = params.surveyId;
    if (params.userId) filter.userId = params.userId;

    const limit = params.limit || 20;
    const page = params.page || 1;

    const [records, totalCount] = await Promise.all([
      this.chainModel
        .find(filter)
        .sort({ sequence: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.chainModel.countDocuments(filter),
    ]);

    return { records, totalCount, page, limit };
  }

  async tamper(sequence: number, hash: string): Promise<void> {
    await this.chainModel.collection.updateOne(
      { sequence },
      { $set: { hash } },
    );
  }

  // ─── getCompromisedBlocks ─────────────────────────────────────────────────
  //
  // forceFull: when true, resets the DB-level lastVerifiedSequence to 0 before
  // running the verify so the scan starts from genesis regardless of any
  // previously cached progress. Use this when the user suspects the tamper
  // happened at a sequence that was already marked verified.

  async getCompromisedBlocks(
    scope: 'voting' | 'survey',
    scopeId: string,
    forceFull = false,
  ): Promise<{ records: any[] }> {
    // When forceFull, wipe the DB cache for this scope so verifyXChain
    // ignores lastVerifiedSequence and scans from genesis.
    if (forceFull) {
      await this.setLastVerifiedSequence(scope, scopeId, 0);
    }

    let result: ScopedVerifyResult & {
      errorType?: 'TAMPERED_HASH' | 'BROKEN_LINK';
      tamperedBlock?: any;
      victimBlock?: any;
      expectedHash?: string;
      foundHash?: string;
      expectedPrevHash?: string;
      foundPrevHash?: string;
    };

    if (scope === 'voting') {
      // Always force a full scan here so we don't miss a tamper that happened
      // before the last cached verified sequence.
      result = (await this.verifyVotingChain(scopeId, true)) as any;
    } else {
      result = (await this.verifySurveyChain(scopeId, true)) as any;
    }

    console.log(`[AuditService] Compromised blocks check for ${scope}:${scopeId}:`, {
      valid: result.valid,
      errorType: result.errorType,
      brokenAt: result.brokenAt,
    });

    if (result.valid || result.brokenAt == null) {
      return { records: [] };
    }

    const seqField = scope === 'voting' ? 'votingSequence' : 'surveySequence';
    const prevHashField =
      scope === 'voting' ? 'votingPrevHash' : 'surveyPrevHash';
    const idField = scope === 'voting' ? 'votingId' : 'surveyId';

    const select = {
      sequence: 1,
      groupSequence: 1,
      votingSequence: 1,
      surveySequence: 1,
      action: 1,
      payload: 1,
      hash: 1,
      prevHash: 1,
      votingPrevHash: 1,
      surveyPrevHash: 1,
      createdAt: 1,
    };

    if (result.errorType === 'TAMPERED_HASH' && result.tamperedBlock) {
      const tampered = result.tamperedBlock;
      const tamperedSeq = tampered[seqField] as number;
      const corruptedHash = tampered.hash as string;
      const expectedHash = result.expectedHash as string;

      // The victim is the block AFTER the tampered one — its prevHash now
      // points to the corrupted hash instead of the original good hash.
      const victimDoc = (await this.chainModel
        .findOne({ [idField]: scopeId, [seqField]: tamperedSeq + 1 })
        .select(select)
        .lean()) as any;

      const records: any[] = [
        {
          ...tampered,
          __breakRole: 'tampered',
          __corruptedHash: corruptedHash,
          __expectedHash: expectedHash,
        },
      ];

      if (victimDoc) {
        records.push({
          ...victimDoc,
          __breakRole: 'victim',
          __victimPrevHash: victimDoc[prevHashField] as string,
          __victimExpectedPrevHash: expectedHash,
        });
      }

      records.sort((a, b) => (a[seqField] ?? 0) - (b[seqField] ?? 0));
      return { records };
    }

    if (result.errorType === 'BROKEN_LINK' && result.victimBlock) {
      const victim = result.victimBlock;
      const victimSeq = victim[seqField] as number;
      const expectedPrevHash = result.expectedPrevHash as string;
      const foundPrevHash = result.foundPrevHash as string;

      // The predecessor is the block BEFORE the victim — its hash is what the
      // victim's prevHash should equal.
      const predecessorDoc = (await this.chainModel
        .findOne({ [idField]: scopeId, [seqField]: victimSeq - 1 })
        .select(select)
        .lean()) as any;

      const records: any[] = [];

      if (predecessorDoc) {
        records.push({
          ...predecessorDoc,
          __breakRole: 'tampered',
          __corruptedHash: predecessorDoc.hash as string,
          __expectedHash: expectedPrevHash,
        });
      }

      records.push({
        ...victim,
        __breakRole: 'victim',
        __victimPrevHash: foundPrevHash,
        __victimExpectedPrevHash: expectedPrevHash,
      });

      records.sort((a, b) => (a[seqField] ?? 0) - (b[seqField] ?? 0));
      return { records };
    }

    // Fallback: generic break without errorType — surface the two blocks
    // around brokenAt with best-effort forensic tags.
    const brokenSeq = result.brokenAt as number;

    const contextDocs = (await this.chainModel
      .find({
        [idField]: scopeId,
        [seqField]: { $in: [brokenSeq - 1, brokenSeq] },
      })
      .sort({ [seqField]: 1 })
      .select(select)
      .lean()) as any[];

    const predecessor = contextDocs.find((d) => d[seqField] === brokenSeq - 1);

    const tagged = contextDocs.map((doc) => {
      if (doc[seqField] === brokenSeq) {
        return {
          ...doc,
          __breakRole: 'victim',
          __victimPrevHash: doc[prevHashField] as string,
          __victimExpectedPrevHash: predecessor?.hash ?? null,
        };
      }
      return {
        ...doc,
        __breakRole: 'tampered',
        __corruptedHash: doc.hash as string,
        __expectedHash: null,
      };
    });

    return { records: tagged };
  }

  async appendChain(ctx: AuditChainContext): Promise<void> {
    const lockKey = 'lock:audit:append';
    let lockToken: string | null = null;

    try {
      for (let i = 0; i < 5; i++) {
        lockToken = await this.redis.acquireLock(lockKey, 5);
        if (lockToken) break;
        await new Promise((resolve) => setTimeout(resolve, 50 * (i + 1)));
      }

      if (!lockToken) {
        this.logger.error(
          'Failed to acquire audit lock - potential integrity risk or high load',
        );
      }

      const [globalSeq, groupSeq, votingSeq, surveySeq] = await Promise.all([
        this.redis.nextGlobalSequence(),
        ctx.groupId
          ? this.redis.nextGroupSequence(ctx.groupId)
          : Promise.resolve(null),
        ctx.votingId
          ? this.redis.nextVotingSequence(ctx.votingId)
          : Promise.resolve(null),
        ctx.surveyId
          ? this.redis.nextSurveySequence(ctx.surveyId)
          : Promise.resolve(null),
      ]);

      const [globalPrev, groupPrev, votingPrev, surveyPrev] = await Promise.all(
        [
          this.getPrevHash('global', null),
          ctx.groupId
            ? this.getPrevHash('group', ctx.groupId)
            : Promise.resolve(null),
          ctx.votingId
            ? this.getPrevHash('voting', ctx.votingId)
            : Promise.resolve(null),
          ctx.surveyId
            ? this.getPrevHash('survey', ctx.surveyId)
            : Promise.resolve(null),
        ],
      );

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
        groupSequence: groupSeq ?? undefined,
        votingSequence: votingSeq ?? undefined,
        surveySequence: surveySeq ?? undefined,
        action: ctx.action,
        payload: ctx.payload,
        userId: ctx.userId ?? undefined,
        groupId: ctx.groupId ?? undefined,
        votingId: ctx.votingId ?? undefined,
        surveyId: ctx.surveyId ?? undefined,
        createdAt,
        prevHash: globalPrev,
        groupPrevHash: groupPrev ?? undefined,
        votingPrevHash: votingPrev ?? undefined,
        surveyPrevHash: surveyPrev ?? undefined,
        hash,
      });
    } catch (err) {
      this.logger.error('Failed to append audit chain entry', err);
    } finally {
      if (lockToken) {
        await this.redis.releaseLock(lockKey, lockToken);
      }
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

  async createCheckpoint(
    scope: 'global' | 'group' | 'voting' | 'survey',
    scopeId: string | null,
  ): Promise<void> {
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
      .select({ sequence: 1, hash: 1 })
      .lean();

    if (!last) {
      throw new Error(
        `Cannot create checkpoint for empty chain scope: ${scope}`,
      );
    }

    await this.checkpointModel.create({
      scope,
      scopeId,
      sequence: (last as any).sequence,
      hash: (last as any).hash,
      createdAt: new Date(),
    });

    this.logger.log(
      `Checkpoint created for ${scope}:${scopeId} at sequence ${(last as any).sequence}`,
    );
  }

  async verifyCheckpoints(
    scope: 'global' | 'group' | 'voting' | 'survey',
    scopeId: string | null,
  ): Promise<{ valid: boolean; brokenAt?: number; reason?: string }> {
    const checkpoints = await this.checkpointModel
      .find({ scope, scopeId })
      .sort({ sequence: 1 })
      .lean();

    for (const cp of checkpoints) {
      const doc = await this.chainModel
        .findOne({ sequence: cp.sequence })
        .select({ hash: 1 })
        .lean();

      if (!doc) {
        return {
          valid: false,
          brokenAt: cp.sequence,
          reason: `Checkpoint sequence ${cp.sequence} missing from chain. Possible deletion.`,
        };
      }

      if ((doc as any).hash !== cp.hash) {
        return {
          valid: false,
          brokenAt: cp.sequence,
          reason: `Checkpoint hash mismatch at sequence ${cp.sequence}. The chain has been recalculated or tampered with since the seal was applied.`,
        };
      }
    }

    return { valid: true };
  }

  async findBallotReceipt(
    entityId: string,
    hashes: string | string[],
    type: 'voting' | 'survey' = 'voting',
  ): Promise<
    Array<{
      hash: string;
      found: boolean;
      sequence?: number;
      blockHash?: string;
      prevHash?: string;
      timestamp?: Date;
    }>
  > {
    let hashArray: string[] = [];
    if (Array.isArray(hashes)) {
      hashArray = hashes;
    } else if (typeof hashes === 'string') {
      hashArray = hashes
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
    }

    const results: Array<{
      hash: string;
      found: boolean;
      sequence?: number;
      blockHash?: string;
      prevHash?: string;
      timestamp?: Date;
    }> = [];

    for (const h of hashArray) {
      const filter: any = {
        action:
          type === 'voting'
            ? ChainAction.BALLOT_CAST
            : ChainAction.SURVEY_BALLOT_CAST,
      };

      if (type === 'voting') {
        filter.votingId = entityId;
        filter['payload.ballotHashes'] = h;
      } else {
        filter.surveyId = entityId;
        filter['payload.ballotHashes'] = h;
      }

      const doc = await this.chainModel
        .findOne(filter)
        .select({ sequence: 1, hash: 1, prevHash: 1, createdAt: 1 })
        .lean();

      if (!doc) {
        results.push({ hash: h, found: false });
      } else {
        results.push({
          hash: h,
          found: true,
          sequence: (doc as any).sequence,
          blockHash: (doc as any).hash,
          prevHash: (doc as any).prevHash,
          timestamp: (doc as any).createdAt,
        });
      }
    }

    return results;
  }

  async verifyChain(
    groupId?: string | null,
    forceFull = false,
    onProgress?: (progress: number) => void,
  ): Promise<ScopedVerifyResult> {
    const filter: any = groupId ? { groupId } : {};
    const scope = groupId ? 'group' : 'global';
    const scopeId = groupId || null;

    if (forceFull) {
      const status = await this.getAuditStatus(scope, scopeId);
      if (status.lastFullVerificationAt) {
        const last = new Date(status.lastFullVerificationAt).getTime();
        const now = new Date().getTime();
        if (now - last < 24 * 3600 * 1000) {
          throw new HttpException(
            'Full verification is throttled to once per 24 hours. Use incremental verification instead.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    }

    const cpResult = await this.verifyCheckpoints(scope, scopeId);
    if (!cpResult.valid) {
      return {
        valid: false,
        totalChecked: 0,
        brokenAt: cpResult.brokenAt || null,
        reason: cpResult.reason || 'Checkpoint verification failed.',
        scope,
        scopeId: scopeId ?? undefined,
      };
    }

    const lastVerified = forceFull
      ? null
      : await this.getLastVerifiedSequence(scope, scopeId);

    if (lastVerified) {
      filter['sequence'] = { $gt: lastVerified };
    }

    const totalToVerify = await this.chainModel.countDocuments(filter);
    if (totalToVerify === 0) {
      return {
        valid: true,
        totalChecked: 0,
        brokenAt: null,
        reason: null,
        scope,
        scopeId: scopeId ?? undefined,
      };
    }

    if (onProgress) onProgress(0);

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
    let expectedPrevHash: string | null = null;
    let prevSequence: number | null = null;
    let prevCreatedAt: Date | null = null;
    let headSequence = 0;

    if (!lastVerified) {
      expectedPrevHash = crypto
        .createHash('sha256')
        .update(GENESIS_SEED, 'utf8')
        .digest('hex');
    } else {
      headSequence = lastVerified;
      prevSequence = lastVerified;
      const lastDoc = await this.chainModel
        .findOne({ sequence: lastVerified })
        .select({ hash: 1, createdAt: 1 })
        .lean();
      if (lastDoc) {
        expectedPrevHash = (lastDoc as any).hash;
        prevCreatedAt = new Date((lastDoc as any).createdAt);
      }
    }

    for await (const raw of cursor) {
      const doc = raw as any;
      totalChecked++;

      if (
        onProgress &&
        (totalChecked % 5 === 0 || totalChecked === totalToVerify)
      ) {
        const progress = Math.round((totalChecked / totalToVerify) * 100);
        this.logger.debug(
          `[${scope}] Verification progress: ${progress}% (${totalChecked}/${totalToVerify})`,
        );
        onProgress(progress);
      }

      if (
        prevSequence !== null &&
        doc.sequence !== prevSequence + 1 &&
        !groupId
      ) {
        await this.setLastVerifiedSequence(scope, scopeId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.sequence,
          reason: `Sequence gap: expected ${prevSequence + 1}, got ${doc.sequence}. Possible deletion.`,
          scope,
          scopeId: scopeId ?? undefined,
        };
      }

      const currentCreatedAt = new Date(doc.createdAt);
      if (prevCreatedAt !== null && currentCreatedAt < prevCreatedAt) {
        await this.setLastVerifiedSequence(scope, scopeId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.sequence,
          reason: `Time manipulation detected: block ${doc.sequence} has timestamp ${currentCreatedAt.toISOString()} which is earlier than previous block ${prevCreatedAt.toISOString()}.`,
          scope,
          scopeId: scopeId ?? undefined,
        };
      }

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
        await this.setLastVerifiedSequence(scope, scopeId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.sequence,
          reason: `Hash mismatch at sequence ${doc.sequence}. Entry has been tampered.`,
          expectedHash: expected,
          foundHash: doc.hash,
          tamperedBlock: doc,
          errorType: 'TAMPERED_HASH',
          scope,
          scopeId: scopeId ?? undefined,
        };
      }

      if (
        !groupId &&
        expectedPrevHash !== null &&
        doc.prevHash !== expectedPrevHash
      ) {
        await this.setLastVerifiedSequence(scope, scopeId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.sequence,
          reason: `prevHash mismatch at sequence ${doc.sequence}. Chain link broken.`,
          errorType: 'BROKEN_LINK',
          expectedPrevHash: expectedPrevHash,
          foundPrevHash: doc.prevHash,
          victimBlock: doc,
          scope,
          scopeId: scopeId ?? undefined,
        };
      }

      expectedPrevHash = doc.hash;
      prevSequence = doc.sequence;
      prevCreatedAt = currentCreatedAt;
      headSequence = doc.sequence;
    }

    if (headSequence > (lastVerified || 0)) {
      await this.setLastVerifiedSequence(scope, scopeId, headSequence, forceFull);
    }

    return {
      valid: true,
      totalChecked,
      brokenAt: null,
      reason: null,
      scope,
      scopeId: scopeId ?? undefined,
    };
  }

  async verifyVotingChain(
    votingId: string,
    forceFull = false,
    onProgress?: (progress: number) => void,
  ): Promise<ScopedVerifyResult> {
    const scope = 'voting';

    if (forceFull) {
      const status = await this.getAuditStatus(scope, votingId);
      if (status.lastFullVerificationAt) {
        const last = new Date(status.lastFullVerificationAt).getTime();
        const now = new Date().getTime();
        if (now - last < 24 * 3600 * 1000) {
          throw new HttpException(
            'Full verification is throttled to once per 24 hours. Use incremental verification instead.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    }

    const cpResult = await this.verifyCheckpoints(scope, votingId);
    if (!cpResult.valid) {
      return {
        valid: false,
        totalChecked: 0,
        brokenAt: cpResult.brokenAt || null,
        reason: cpResult.reason || 'Checkpoint verification failed.',
        scope,
        scopeId: votingId,
      };
    }

    const lastVerified = forceFull
      ? null
      : await this.getLastVerifiedSequence(scope, votingId);

    const filter: any = { votingId, votingSequence: { $ne: null } };
    if (lastVerified) {
      filter['votingSequence'] = { $gt: lastVerified };
    }

    const totalToVerify = await this.chainModel.countDocuments(filter);
    if (totalToVerify === 0) {
      return {
        valid: true,
        totalChecked: 0,
        brokenAt: null,
        reason: null,
        scope,
        scopeId: votingId,
      };
    }

    if (onProgress) onProgress(0);

    const cursor = this.chainModel
      .find(filter)
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
    let prevCreatedAt: Date | null = null;
    let headSequence = lastVerified || 0;

    if (!lastVerified) {
      expectedPrevHash = crypto
        .createHash('sha256')
        .update(`${GENESIS_SEED}:voting:${votingId}`, 'utf8')
        .digest('hex');
      prevSequence = 0;
    } else {
      prevSequence = lastVerified;
      const lastDoc = await this.chainModel
        .findOne({ votingId, votingSequence: lastVerified })
        .select({ hash: 1, createdAt: 1 })
        .lean();
      if (lastDoc) {
        expectedPrevHash = (lastDoc as any).hash;
        prevCreatedAt = new Date((lastDoc as any).createdAt);
      }
    }

    for await (const raw of cursor) {
      const doc = raw as any;
      totalChecked++;

      if (
        onProgress &&
        (totalChecked % 5 === 0 || totalChecked === totalToVerify)
      ) {
        onProgress(Math.round((totalChecked / totalToVerify) * 100));
      }

      if (prevSequence !== null && doc.votingSequence !== prevSequence + 1) {
        await this.setLastVerifiedSequence(scope, votingId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.votingSequence,
          reason: `Voting sequence gap: expected ${prevSequence + 1}, got ${doc.votingSequence}. Possible deletion.`,
          scope,
          scopeId: votingId,
        };
      }

      const currentCreatedAt = new Date(doc.createdAt);
      if (prevCreatedAt !== null && currentCreatedAt < prevCreatedAt) {
        await this.setLastVerifiedSequence(scope, votingId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.votingSequence,
          reason: `Time manipulation detected: block ${doc.votingSequence} has timestamp ${currentCreatedAt.toISOString()} which is earlier than previous block ${prevCreatedAt.toISOString()}.`,
          scope,
          scopeId: votingId,
        };
      }

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
        createdAt: currentCreatedAt,
      });

      if (expected !== doc.hash) {
        await this.setLastVerifiedSequence(scope, votingId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.votingSequence,
          reason: `TAMPERED: hash mismatch at voting sequence ${doc.votingSequence}.`,
          errorType: 'TAMPERED_HASH',
          expectedHash: expected,
          foundHash: doc.hash,
          tamperedBlock: doc,
          scope,
          scopeId: votingId,
        };
      }

      if (
        expectedPrevHash !== null &&
        doc.votingPrevHash !== expectedPrevHash
      ) {
        await this.setLastVerifiedSequence(scope, votingId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.votingSequence,
          reason: `BROKEN_LINK: votingPrevHash mismatch at sequence ${doc.votingSequence}.`,
          errorType: 'BROKEN_LINK',
          expectedPrevHash: expectedPrevHash,
          foundPrevHash: doc.votingPrevHash,
          victimBlock: doc,
          scope,
          scopeId: votingId,
        };
      }

      expectedPrevHash = doc.hash;
      prevSequence = doc.votingSequence;
      prevCreatedAt = currentCreatedAt;
      headSequence = doc.votingSequence;
    }

    if (headSequence > (lastVerified || 0)) {
      await this.setLastVerifiedSequence(scope, votingId, headSequence, forceFull);
    }

    return {
      valid: true,
      totalChecked,
      brokenAt: null,
      reason: null,
      scope,
      scopeId: votingId,
    };
  }

  async verifyGroupChain(
    groupId: string,
    forceFull = false,
    onProgress?: (progress: number) => void,
  ): Promise<ScopedVerifyResult> {
    const scope = 'group';

    if (forceFull) {
      const status = await this.getAuditStatus(scope, groupId);
      if (status.lastFullVerificationAt) {
        const last = new Date(status.lastFullVerificationAt).getTime();
        const now = new Date().getTime();
        if (now - last < 24 * 3600 * 1000) {
          throw new HttpException(
            'Full verification is throttled to once per 24 hours. Use incremental verification instead.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    }

    const cpResult = await this.verifyCheckpoints(scope, groupId);
    if (!cpResult.valid) {
      return {
        valid: false,
        totalChecked: 0,
        brokenAt: cpResult.brokenAt || null,
        reason: cpResult.reason || 'Checkpoint verification failed.',
        scope,
        scopeId: groupId,
      };
    }

    const lastVerified = forceFull
      ? null
      : await this.getLastVerifiedSequence(scope, groupId);

    const filter: any = { groupId, groupSequence: { $ne: null } };
    if (lastVerified) {
      filter['groupSequence'] = { $gt: lastVerified };
    }

    const totalToVerify = await this.chainModel.countDocuments(filter);
    if (totalToVerify === 0) {
      return {
        valid: true,
        totalChecked: 0,
        brokenAt: null,
        reason: null,
        scope,
        scopeId: groupId,
      };
    }

    if (onProgress) onProgress(0);

    const cursor = this.chainModel
      .find(filter)
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
    let prevCreatedAt: Date | null = null;
    let headSequence = 0;

    if (!lastVerified) {
      expectedPrevHash = crypto
        .createHash('sha256')
        .update(`${GENESIS_SEED}:group:${groupId}`, 'utf8')
        .digest('hex');
    } else {
      headSequence = lastVerified;
      prevSequence = lastVerified;
      const lastDoc = await this.chainModel
        .findOne({ groupId, groupSequence: lastVerified })
        .select({ hash: 1, createdAt: 1 })
        .lean();
      if (lastDoc) {
        expectedPrevHash = (lastDoc as any).hash;
        prevCreatedAt = new Date((lastDoc as any).createdAt);
      }
    }

    for await (const raw of cursor) {
      const doc = raw as any;
      totalChecked++;

      if (
        onProgress &&
        (totalChecked % 5 === 0 || totalChecked === totalToVerify)
      ) {
        onProgress(Math.round((totalChecked / totalToVerify) * 100));
      }

      if (prevSequence !== null && doc.groupSequence !== prevSequence + 1) {
        await this.setLastVerifiedSequence(scope, groupId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.groupSequence,
          reason: `Group sequence gap: expected ${prevSequence + 1}, got ${doc.groupSequence}. Possible deletion.`,
          scope,
          scopeId: groupId,
        };
      }

      const currentCreatedAt = new Date(doc.createdAt);
      if (prevCreatedAt !== null && currentCreatedAt < prevCreatedAt) {
        await this.setLastVerifiedSequence(scope, groupId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.groupSequence,
          reason: `Time manipulation detected: block ${doc.groupSequence} has timestamp ${currentCreatedAt.toISOString()} which is earlier than previous block ${prevCreatedAt.toISOString()}.`,
          scope,
          scopeId: groupId,
        };
      }

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
        createdAt: currentCreatedAt,
      });

      if (expected !== doc.hash) {
        await this.setLastVerifiedSequence(scope, groupId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.groupSequence,
          reason: `Hash mismatch at group sequence ${doc.groupSequence}. Entry has been tampered.`,
          expectedHash: expected,
          foundHash: doc.hash,
          tamperedBlock: doc,
          scope,
          scopeId: groupId,
        };
      }

      if (expectedPrevHash !== null && doc.groupPrevHash !== expectedPrevHash) {
        await this.setLastVerifiedSequence(scope, groupId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.groupSequence,
          reason: `groupPrevHash mismatch at sequence ${doc.groupSequence}. Chain link broken.`,
          scope,
          scopeId: groupId,
        };
      }

      expectedPrevHash = doc.hash;
      prevSequence = doc.groupSequence;
      prevCreatedAt = currentCreatedAt;
      headSequence = doc.groupSequence;
    }

    if (headSequence > (lastVerified || 0)) {
      await this.setLastVerifiedSequence(scope, groupId, headSequence, forceFull);
    }

    return {
      valid: true,
      totalChecked,
      brokenAt: null,
      reason: null,
      scope,
      scopeId: groupId,
    };
  }

  async verifySurveyChain(
    surveyId: string,
    forceFull = false,
    onProgress?: (progress: number) => void,
  ): Promise<ScopedVerifyResult> {
    const scope = 'survey';

    if (forceFull) {
      const status = await this.getAuditStatus(scope, surveyId);
      if (status.lastFullVerificationAt) {
        const last = new Date(status.lastFullVerificationAt).getTime();
        const now = new Date().getTime();
        if (now - last < 24 * 3600 * 1000) {
          throw new HttpException(
            'Full verification is throttled to once per 24 hours. Use incremental verification instead.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    }

    const cpResult = await this.verifyCheckpoints(scope, surveyId);
    if (!cpResult.valid) {
      return {
        valid: false,
        totalChecked: 0,
        brokenAt: cpResult.brokenAt || null,
        reason: cpResult.reason || 'Checkpoint verification failed.',
        scope,
        scopeId: surveyId,
      };
    }

    const lastVerified = forceFull
      ? null
      : await this.getLastVerifiedSequence(scope, surveyId);

    const filter: any = { surveyId, surveySequence: { $ne: null } };
    if (lastVerified) {
      filter['surveySequence'] = { $gt: lastVerified };
    }

    const totalToVerify = await this.chainModel.countDocuments(filter);
    if (totalToVerify === 0) {
      return {
        valid: true,
        totalChecked: 0,
        brokenAt: null,
        reason: null,
        scope,
        scopeId: surveyId,
      };
    }

    if (onProgress) onProgress(0);

    const cursor = this.chainModel
      .find(filter)
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
    let prevCreatedAt: Date | null = null;
    let headSequence = 0;

    if (!lastVerified) {
      expectedPrevHash = crypto
        .createHash('sha256')
        .update(`${GENESIS_SEED}:survey:${surveyId}`, 'utf8')
        .digest('hex');
    } else {
      headSequence = lastVerified;
      prevSequence = lastVerified;
      const lastDoc = await this.chainModel
        .findOne({ surveyId, surveySequence: lastVerified })
        .select({ hash: 1, createdAt: 1 })
        .lean();
      if (lastDoc) {
        expectedPrevHash = (lastDoc as any).hash;
        prevCreatedAt = new Date((lastDoc as any).createdAt);
      }
    }

    for await (const raw of cursor) {
      const doc = raw as any;
      totalChecked++;

      if (
        onProgress &&
        (totalChecked % 5 === 0 || totalChecked === totalToVerify)
      ) {
        onProgress(Math.round((totalChecked / totalToVerify) * 100));
      }

      if (prevSequence !== null && doc.surveySequence !== prevSequence + 1) {
        await this.setLastVerifiedSequence(scope, surveyId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.surveySequence,
          reason: `Survey sequence gap: expected ${prevSequence + 1}, got ${doc.surveySequence}. Possible deletion.`,
          scope,
          scopeId: surveyId,
        };
      }

      const currentCreatedAt = new Date(doc.createdAt);
      if (prevCreatedAt !== null && currentCreatedAt < prevCreatedAt) {
        await this.setLastVerifiedSequence(scope, surveyId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.surveySequence,
          reason: `Time manipulation detected: block ${doc.surveySequence} has timestamp ${currentCreatedAt.toISOString()} which is earlier than previous block ${prevCreatedAt.toISOString()}.`,
          scope,
          scopeId: surveyId,
        };
      }

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
        createdAt: currentCreatedAt,
      });

      if (expected !== doc.hash) {
        await this.setLastVerifiedSequence(scope, surveyId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.surveySequence,
          reason: `TAMPERED: hash mismatch at survey sequence ${doc.surveySequence}.`,
          errorType: 'TAMPERED_HASH', // ← was missing
          expectedHash: expected,
          foundHash: doc.hash,
          tamperedBlock: doc, // ← was missing
          scope,
          scopeId: surveyId,
        };
      }

      if (
        expectedPrevHash !== null &&
        doc.surveyPrevHash !== expectedPrevHash
      ) {
        await this.setLastVerifiedSequence(scope, surveyId, 0);
        return {
          valid: false,
          totalChecked,
          brokenAt: doc.surveySequence,
          reason: `BROKEN_LINK: surveyPrevHash mismatch at sequence ${doc.surveySequence}.`,
          errorType: 'BROKEN_LINK', // ← was missing
          expectedPrevHash: expectedPrevHash,
          foundPrevHash: doc.surveyPrevHash,
          victimBlock: doc, // ← was missing
          scope,
          scopeId: surveyId,
        };
      }

      expectedPrevHash = doc.hash;
      prevSequence = doc.surveySequence;
      prevCreatedAt = currentCreatedAt;
      headSequence = doc.surveySequence;
    }

    if (headSequence > (lastVerified || 0)) {
      await this.setLastVerifiedSequence(scope, surveyId, headSequence, forceFull);
    }

    return {
      valid: true,
      totalChecked,
      brokenAt: null,
      reason: null,
      scope,
      scopeId: surveyId,
    };
  }
}
