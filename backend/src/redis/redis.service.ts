import { Injectable, Inject, Logger, ForbiddenException } from '@nestjs/common';
import Redis from 'ioredis';
import { CryptoUtils } from '../common/utils/crypto-utils';

@Injectable()
export class RedisVotingService {
  private readonly logger = new Logger(RedisVotingService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  // ─── AUTH METHODS ──────────────────────────────────────────────────────────

  private voterHash(userId: string, votingId: string): string {
    return CryptoUtils.hash(`${userId}:${votingId}`);
  }

  async setRefreshToken(
    userId: string,
    token: string,
    expiresInSeconds: number,
  ): Promise<void> {
    await this.redis.set(
      `auth:refresh:${token}`,
      userId,
      'EX',
      expiresInSeconds,
    );
  }

  async getUserIdByToken(token: string): Promise<string | null> {
    return this.redis.get(`auth:refresh:${token}`);
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.redis.del(`auth:refresh:${token}`);
  }

  // ─── GENERIC KEY ACCESS ────────────────────────────────────────────────────

  /**
   * Get a raw string value by key.
   */
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  /**
   * Delete one or more keys.
   */
  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // ─── DISTRIBUTED LOCK ──────────────────────────────────────────────────────

  async acquireLock(lockKey: string, ttlSeconds = 10): Promise<string | null> {
    const token = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    const result = await this.redis.set(lockKey, token, 'EX', ttlSeconds, 'NX');
    return result === 'OK' ? token : null;
  }

  async releaseLock(lockKey: string, token: string): Promise<void> {
    const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
    await this.redis.eval(script, 1, lockKey, token);
  }

  // ─── VOTING RESULT CACHE ───────────────────────────────────────────────────

  async hasUserVoted(votingId: string, userId: string): Promise<boolean> {
    const result = await this.redis.sismember(
      `voting:${votingId}:voters`,
      this.voterHash(userId, votingId),
    );
    return result === 1;
  }

  async performVote(
    votingId: string,
    optionIds: string[],
    userId: string,
    isAbstention = false,
    isPractice = false,
  ): Promise<void> {
    if (isPractice) {
      this.logger.debug(
        `Practice vote for voting ${votingId} by user ${userId} - skipping persistence`,
      );
      return;
    }

    const pipeline = this.redis.pipeline();
    pipeline.sadd(
      `voting:${votingId}:voters`,
      this.voterHash(userId, votingId),
    );
    if (isAbstention) {
      pipeline.hincrby(`voting:${votingId}:results`, 'ABSTENTION_COUNT', 1);
    } else {
      optionIds.forEach((id) =>
        pipeline.hincrby(`voting:${votingId}:results`, id, 1),
      );
    }

    // Track global stats for dashboard
    pipeline.incr('global:vote_count');

    // Track trends (votes per hour)
    const hourKey = new Date().toISOString().substring(0, 13);
    pipeline.hincrby('global:trends', hourKey, 1);

    await pipeline.exec();
  }

  async getResults(votingId: string): Promise<Record<string, string>> {
    return this.redis.hgetall(`voting:${votingId}:results`);
  }

  async clearVotingData(votingId: string): Promise<void> {
    const lockKeys = await this.redis.keys(`vote_lock:${votingId}:*`);
    const pipeline = this.redis.pipeline();
    if (lockKeys.length > 0) pipeline.del(...lockKeys);
    pipeline.del(`voting:${votingId}:results`, `voting:${votingId}:voters`);
    await pipeline.exec();
  }

  // ─── GLOBAL DASHBOARD METHODS ──────────────────────────────────────────────

  async getGlobalStats() {
    const [totalVotes, activeVotings] = await Promise.all([
      this.redis.get('global:vote_count'),
      this.redis.get('global:active_votings'),
    ]);
    return {
      totalVotes: parseInt(totalVotes || '0', 10),
      activeVotings: parseInt(activeVotings || '0', 10),
    };
  }

  async getGlobalTrends() {
    const trends = await this.redis.hgetall('global:trends');
    // Sort keys (dates) to ensure chronological order for the graph
    return Object.keys(trends)
      .sort()
      .map((key) => ({
        timestamp: key,
        count: parseInt(trends[key], 10),
      }));
  }

  async updateActiveVotingsCount(count: number): Promise<void> {
    await this.redis.set('global:active_votings', count);
  }

  // ─── SURVEY RESULT CACHE ───────────────────────────────────────────────────

  async hasUserSubmittedSurvey(
    surveyId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.redis.sismember(
      `survey:${surveyId}:voters`,
      userId,
    );
    return result === 1;
  }

  async getSurveyVoterCount(surveyId: string): Promise<number> {
    return this.redis.scard(`survey:${surveyId}:voters`);
  }

  async markSurveySubmitted(surveyId: string, userId: string): Promise<void> {
    await this.redis.sadd(`survey:${surveyId}:voters`, userId);
  }

  async performSurveySubmission(
    surveyId: string,
    userId: string,
    answers: { questionId: string; optionIds: string[]; hasOther?: boolean }[],
    isAbstention = false,
    isPractice = false,
  ): Promise<void> {
    if (isPractice) {
      this.logger.debug(
        `Practice survey submission for survey ${surveyId} by user ${userId} - skipping persistence`,
      );
      return;
    }

    const hasSubmitted = await this.hasUserSubmittedSurvey(surveyId, userId);
    if (hasSubmitted) throw new Error('User has already submitted this survey');

    const pipeline = this.redis.pipeline();
    pipeline.sadd(`survey:${surveyId}:voters`, userId);

    if (isAbstention) {
      pipeline.hincrby(
        `survey:${surveyId}:results:global`,
        'ABSTENTION_COUNT',
        1,
      );
    } else {
      answers.forEach(({ questionId, optionIds, hasOther }) => {
        const resultsKey = `survey:${surveyId}:results:${questionId}`;
        optionIds.forEach((optionId) =>
          pipeline.hincrby(resultsKey, optionId, 1),
        );
        if (hasOther) pipeline.hincrby(resultsKey, 'OTHER_COUNT', 1);
      });
    }

    await pipeline.exec();
  }

  async getQuestionResults(
    surveyId: string,
    questionId: string,
  ): Promise<Record<string, string>> {
    return this.redis.hgetall(`survey:${surveyId}:results:${questionId}`);
  }

  async clearSurveyData(surveyId: string): Promise<void> {
    const votersKey = `survey:${surveyId}:voters`;

    const scan = async (pattern: string): Promise<string[]> => {
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [next, found] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = next;
        keys.push(...found);
      } while (cursor !== '0');
      return keys;
    };

    const [resultsKeys, lockKeys] = await Promise.all([
      scan(`survey:${surveyId}:results:*`),
      scan(`survey_lock:${surveyId}:*`),
    ]);

    const pipeline = this.redis.pipeline();
    pipeline.del(votersKey);
    if (resultsKeys.length > 0) pipeline.del(...resultsKeys);
    if (lockKeys.length > 0) pipeline.del(...lockKeys);
    await pipeline.exec();
  }

  // ─── SURVEY SELECTIONS (full ballot payload) ───────────────────────────────

  private surveySelectionsKey(userId: string, surveyId: string): string {
    return `survey_selections:${userId}:${surveyId}`;
  }

  async setSurveySelections(
    userId: string,
    surveyId: string,
    data: { ballots: any[]; isPractice?: boolean },
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(
      this.surveySelectionsKey(userId, surveyId),
      JSON.stringify(data),
      'EX',
      ttlSeconds,
    );
  }

  async getSurveySelections(
    userId: string,
    surveyId: string,
  ): Promise<{ ballots: any[]; isPractice?: boolean } | null> {
    const raw = await this.redis.get(
      this.surveySelectionsKey(userId, surveyId),
    );
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      this.logger.error(
        `Failed to parse survey selections for user ${userId} survey ${surveyId}`,
      );
      return null;
    }
  }

  async deleteSurveySelections(
    userId: string,
    surveyId: string,
  ): Promise<void> {
    await this.redis.del(this.surveySelectionsKey(userId, surveyId));
  }

  // ─── UNIFIED TOKEN METHODS (VOTING + SURVEY) ───────────────────────────────

  private tokenKey(
    type: 'voting' | 'survey',
    userId: string,
    entityId: string,
  ): string {
    return `token:${type}:${userId}:${entityId}`;
  }

  private reverseKey(hash: string): string {
    return `token_reverse:${hash}`;
  }

  async issueToken(
    type: 'voting' | 'survey',
    userId: string,
    entityId: string,
    ttlSeconds = 3600,
    isPractice = false,
  ): Promise<string> {
    this.logger.debug(
      `Issuing token for ${type} ${entityId} and user ${userId} with TTL ${ttlSeconds}s (practice: ${isPractice})`,
    );
    const token = CryptoUtils.generateSecureToken();
    const hash = CryptoUtils.hashToken(token);

    const pipeline = this.redis.pipeline();
    pipeline.set(this.tokenKey(type, userId, entityId), hash, 'EX', ttlSeconds);
    pipeline.set(
      this.reverseKey(hash),
      JSON.stringify({ userId, entityId, type, isPractice }),
      'EX',
      ttlSeconds,
    );
    await pipeline.exec();

    return token;
  }

  async lookupTokenByHash(hash: string): Promise<{
    userId: string;
    entityId: string;
    type: string;
    isPractice?: boolean;
  } | null> {
    const raw = await this.redis.get(this.reverseKey(hash));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      this.logger.error(`Failed to parse token_reverse value for hash ${hash}`);
      return null;
    }
  }

  async verifyToken(
    type: 'voting' | 'survey',
    userId: string,
    entityId: string,
    submittedToken: string,
  ): Promise<{
    userId: string;
    entityId: string;
    type: string;
    isPractice?: boolean;
  }> {
    const hash = CryptoUtils.hashToken(submittedToken);
    const storedHash = await this.redis.get(
      this.tokenKey(type, userId, entityId),
    );
    if (!storedHash) throw new ForbiddenException('Invalid or expired token');
    if (storedHash !== hash) throw new ForbiddenException('Invalid token');

    const meta = await this.lookupTokenByHash(hash);
    if (!meta) throw new ForbiddenException('Token metadata missing');
    return meta;
  }

  async consumeToken(
    type: 'voting' | 'survey',
    userId: string,
    entityId: string,
  ): Promise<void> {
    const hash = await this.redis.get(this.tokenKey(type, userId, entityId));
    const pipeline = this.redis.pipeline();
    pipeline.del(this.tokenKey(type, userId, entityId));
    if (hash) pipeline.del(this.reverseKey(hash));
    await pipeline.exec();
  }

  async tokenExists(
    type: 'voting' | 'survey',
    userId: string,
    entityId: string,
  ): Promise<boolean> {
    return (
      (await this.redis.exists(this.tokenKey(type, userId, entityId))) === 1
    );
  }

  async getStoredHash(
    type: 'voting' | 'survey',
    userId: string,
    entityId: string,
  ): Promise<string | null> {
    return this.redis.get(this.tokenKey(type, userId, entityId));
  }

  // ─── SELECTION METHODS ─────────────────────────────────────────────────────

  async setSelections(
    userId: string,
    entityId: string,
    selections: {
      optionIds: string[];
      otherText?: string;
      isAbstention?: boolean;
      isPractice?: boolean;
    },
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(
      `vote_selections:${userId}:${entityId}`,
      JSON.stringify(selections),
      'EX',
      ttlSeconds,
    );
  }

  async getSelections(
    userId: string,
    entityId: string,
  ): Promise<{
    optionIds: string[];
    otherText?: string;
    isAbstention?: boolean;
    isPractice?: boolean;
  } | null> {
    const raw = await this.redis.get(`vote_selections:${userId}:${entityId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      this.logger.error(`Failed to parse selections for ${userId}:${entityId}`);
      return null;
    }
  }

  async deleteSelections(userId: string, entityId: string): Promise<void> {
    await this.redis.del(`vote_selections:${userId}:${entityId}`);
  }

  // ─── AUDIT SEQUENCE COUNTERS & VERIFICATION MARKERS ───────────────────────

  async nextGlobalSequence(): Promise<number> {
    return this.redis.incr('audit_seq:global');
  }

  async nextGroupSequence(groupId: string): Promise<number> {
    return this.redis.incr(`audit_seq:group:${groupId}`);
  }

  async nextVotingSequence(votingId: string): Promise<number> {
    return this.redis.incr(`audit_seq:voting:${votingId}`);
  }

  async nextSurveySequence(surveyId: string): Promise<number> {
    return this.redis.incr(`audit_seq:survey:${surveyId}`);
  }

  async setLastVerifiedSequence(
    scope: 'global' | 'group' | 'voting' | 'survey',
    scopeId: string | null,
    sequence: number,
  ): Promise<void> {
    const key = scopeId
      ? `audit_ver:${scope}:${scopeId}`
      : `audit_ver:${scope}`;
    await this.redis.set(key, sequence.toString());
  }

  async getLastVerifiedSequence(
    scope: 'global' | 'group' | 'voting' | 'survey',
    scopeId: string | null,
  ): Promise<number | null> {
    const key = scopeId
      ? `audit_ver:${scope}:${scopeId}`
      : `audit_ver:${scope}`;
    const val = await this.redis.get(key);
    return val ? parseInt(val, 10) : null;
  }

  // ─── SNAPSHOT CACHING ──────────────────────────────────────────────────────

  async setSnapshot(key: string, data: any, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  }

  async getSnapshot<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      this.logger.error(`Failed to parse snapshot for key: ${key}`);
      return null;
    }
  }

  // ─── TEMPORARY RECEIPT STORAGE ─────────────────────────────────────────────

  async setTemporaryReceipts(
    votingId: string,
    userId: string,
    receipts: string[],
    ttlSeconds = 300,
  ): Promise<void> {
    await this.redis.set(
      `vote_receipts:${votingId}:${userId}`,
      JSON.stringify(receipts),
      'EX',
      ttlSeconds,
    );
  }

  async getTemporaryReceipts(
    votingId: string,
    userId: string,
  ): Promise<string[] | null> {
    const raw = await this.redis.get(`vote_receipts:${votingId}:${userId}`);
    if (!raw) return null;
    try {
      const receipts = JSON.parse(raw);
      // Consume after retrieval - COMMENTED OUT FOR PERSISTENCE (Plan 4.1)
      // await this.redis.del(`vote_receipts:${votingId}:${userId}`);
      return receipts;
    } catch {
      return null;
    }
  }
}
