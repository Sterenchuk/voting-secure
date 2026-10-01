import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisVotingService {
  private readonly logger = new Logger(RedisVotingService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  // ─── AUTH METHODS ──────────────────────────────────────────────────────────

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
    // Лічильник без ідентичності — жодного збереження "хто голосував"
    pipeline.incr(`voting:${votingId}:total_votes`);

    // Track global stats for dashboard
    pipeline.incr('global:vote_count');

    // Track trends (votes per hour)
    const minuteKey = new Date().toISOString().substring(0, 16);
    pipeline.hincrby('global:trends', minuteKey, 1);

    await pipeline.exec();
  }

  async clearVotingData(votingId: string): Promise<void> {
    const lockKeys = await this.redis.keys(`vote_lock:${votingId}:*`);
    const pipeline = this.redis.pipeline();
    if (lockKeys.length > 0) pipeline.del(...lockKeys);
    pipeline.del(
      `voting:${votingId}:results`,
      `voting:${votingId}:total_votes`,
    );
    await pipeline.exec();
  }

  // ─── GLOBAL DASHBOARD METHODS ──────────────────────────────────────────────

  async getGlobalStats() {
    const [totalVotes, activeVotings, uniqueVotersCount] = await Promise.all([
      this.redis.get('global:vote_count'),
      this.redis.get('global:active_votings'),
      this.redis.scard('global:unique_voters'),
    ]);
    return {
      totalVotes: parseInt(totalVotes || '0', 10),
      activeVotings: parseInt(activeVotings || '0', 10),
      uniqueVotersCount: uniqueVotersCount || 0,
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

  async getSurveyVoterCount(surveyId: string): Promise<number> {
    const count = await this.redis.get(`survey:${surveyId}:responses`);
    return parseInt(count || '0', 10);
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

    const pipeline = this.redis.pipeline();
    pipeline.incr(`survey:${surveyId}:responses`);

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
    const responsesKey = `survey:${surveyId}:responses`;

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
    pipeline.del(responsesKey);
    if (resultsKeys.length > 0) pipeline.del(...resultsKeys);
    if (lockKeys.length > 0) pipeline.del(...lockKeys);
    await pipeline.exec();
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
