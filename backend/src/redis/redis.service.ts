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
  ): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.sadd(
      `voting:${votingId}:voters`,
      this.voterHash(userId, votingId),
    );
    optionIds.forEach((id) =>
      pipeline.hincrby(`voting:${votingId}:results`, id, 1),
    );
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
  ): Promise<void> {
    const hasSubmitted = await this.hasUserSubmittedSurvey(surveyId, userId);
    if (hasSubmitted) throw new Error('User has already submitted this survey');

    const pipeline = this.redis.pipeline();
    pipeline.sadd(`survey:${surveyId}:voters`, userId);

    answers.forEach(({ questionId, optionIds, hasOther }) => {
      const resultsKey = `survey:${surveyId}:results:${questionId}`;
      optionIds.forEach((optionId) =>
        pipeline.hincrby(resultsKey, optionId, 1),
      );
      if (hasOther) pipeline.hincrby(resultsKey, 'OTHER_COUNT', 1);
    });

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

  // ─── UNIFIED TOKEN METHODS (VOTING + SURVEY) ───────────────────────────────
  //
  // Forward key:  token:{type}:{userId}:{entityId}  → tokenHash
  // Reverse key:  token_reverse:{tokenHash}          → { userId, entityId, type }
  //
  // The reverse key allows email-link confirmation to look up the userId
  // from just the raw token — satisfying Rec(2004)11 §47 without a DB table.

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

  /**
   * Issues a new token. If a token already exists for this user+entity,
   * it is overwritten (Redis SET replaces automatically).
   * Returns the raw token string — must be sent via email, never via API response.
   */
  async issueToken(
    type: 'voting' | 'survey',
    userId: string,
    entityId: string,
    ttlSeconds = 3600,
  ): Promise<string> {
    this.logger.debug(
      `Issuing token for ${type} ${entityId} and user ${userId} with TTL ${ttlSeconds}s`,
    );
    const token = CryptoUtils.generateSecureToken();
    const hash = CryptoUtils.hashToken(token);

    const pipeline = this.redis.pipeline();
    pipeline.set(this.tokenKey(type, userId, entityId), hash, 'EX', ttlSeconds);
    pipeline.set(
      this.reverseKey(hash),
      JSON.stringify({ userId, entityId, type }),
      'EX',
      ttlSeconds,
    );
    await pipeline.exec();

    return token;
  }

  /**
   * Looks up token metadata from just the raw token string.
   * Used by email-link confirmation endpoint which has no userId.
   */
  async lookupTokenByHash(
    hash: string,
  ): Promise<{ userId: string; entityId: string; type: string } | null> {
    const raw = await this.redis.get(this.reverseKey(hash));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      this.logger.error(`Failed to parse token_reverse value for hash ${hash}`);
      return null;
    }
  }

  /**
   * Verifies a submitted token against the stored hash.
   * Used during the normal vote flow where userId is known from JWT.
   */
  async verifyToken(
    type: 'voting' | 'survey',
    userId: string,
    entityId: string,
    submittedToken: string,
  ): Promise<void> {
    const storedHash = await this.redis.get(
      this.tokenKey(type, userId, entityId),
    );
    if (!storedHash) throw new ForbiddenException('Invalid or expired token');
    if (storedHash !== CryptoUtils.hashToken(submittedToken))
      throw new ForbiddenException('Invalid token');
  }

  /**
   * Consumes (deletes) a token — both forward and reverse keys.
   * Call after the vote is committed to enforce single-use.
   */
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

  /**
   * Returns the stored hash for a token — used to cross-check in email confirmation.
   */
  async getStoredHash(
    type: 'voting' | 'survey',
    userId: string,
    entityId: string,
  ): Promise<string | null> {
    return this.redis.get(this.tokenKey(type, userId, entityId));
  }

  // ─── SELECTION METHODS ─────────────────────────────────────────────────────
  //
  // Stores user's vote selections when they click "Cast Vote" on the page.
  // Retrieved when the email link is clicked to confirm the vote.
  // TTL matches the token TTL — both expire together.

  async setSelections(
    userId: string,
    entityId: string,
    selections: { optionIds: string[]; otherText?: string },
    ttlSeconds = 3600,
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
  ): Promise<{ optionIds: string[]; otherText?: string } | null> {
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

  // ─── AUDIT SEQUENCE COUNTERS ───────────────────────────────────────────────

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
}
