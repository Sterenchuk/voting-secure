import { Injectable, Inject, Logger, ForbiddenException } from '@nestjs/common';
import Redis from 'ioredis';
import { CryptoUtils } from '../common/utils/crypto-utils';

@Injectable()
export class RedisVotingService {
  private readonly logger = new Logger(RedisVotingService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  // ─── AUTH METHODS ──────────────────────────────────────────────────────────

  async setRefreshToken(
    userId: string,
    token: string,
    expiresInSeconds: number,
  ) {
    const key = `auth:refresh:${token}`;
    await this.redis.set(key, userId, 'EX', expiresInSeconds);
  }

  async getUserIdByToken(token: string): Promise<string | null> {
    return await this.redis.get(`auth:refresh:${token}`);
  }

  async deleteRefreshToken(token: string) {
    await this.redis.del(`auth:refresh:${token}`);
  }

  // ─── DISTRIBUTED LOCK ──────────────────────────────────────────────────────

  public async acquireLock(
    lockKey: string,
    ttlSeconds = 10,
  ): Promise<string | null> {
    const token = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    const result = await this.redis.set(lockKey, token, 'EX', ttlSeconds, 'NX');
    return result === 'OK' ? token : null;
  }

  public async releaseLock(lockKey: string, token: string): Promise<void> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.eval(script, 1, lockKey, token);
  }

  // ─── VOTING METHODS (EU ANONYMITY SPLIT) ───────────────────────────────────

  async markUserVoted(votingId: string, userId: string): Promise<void> {
    const votersKey = `voting:${votingId}:voters`;
    await this.redis.sadd(votersKey, userId);
  }

  async incrementOptionCount(
    votingId: string,
    optionId: string,
  ): Promise<void> {
    const resultsKey = `voting:${votingId}:results`;
    await this.redis.hincrby(resultsKey, optionId, 1);
  }

  async hasUserVoted(votingId: string, userId: string): Promise<boolean> {
    const votersKey = `voting:${votingId}:voters`;
    const result = await this.redis.sismember(votersKey, userId);
    return result === 1;
  }

  async getResults(votingId: string): Promise<Record<string, string>> {
    const key = `voting:${votingId}:results`;
    return await this.redis.hgetall(key);
  }

  async performVote(votingId: string, optionIds: string[], userId: string) {
    const resultsKey = `voting:${votingId}:results`;
    const votersKey = `voting:${votingId}:voters`;

    const pipeline = this.redis.pipeline();

    // Mark user as voted
    pipeline.sadd(votersKey, userId);

    // Increment counts for options
    optionIds.forEach((id) => {
      pipeline.hincrby(resultsKey, id, 1);
    });

    await pipeline.exec();
  }

  async clearVotingData(votingId: string) {
    const pattern = `vote_lock:${votingId}:*`;
    const keys = await this.redis.keys(pattern);
    const pipeline = this.redis.pipeline();
    if (keys.length > 0) pipeline.del(...keys);
    pipeline.del(`voting:${votingId}:results`, `voting:${votingId}:voters`);
    await pipeline.exec();
  }

  // ─── SURVEY METHODS ─────────────────────────────────────────────────────────

  async hasUserSubmittedSurvey(
    surveyId: string,
    userId: string,
  ): Promise<boolean> {
    const key = `survey:${surveyId}:voters`;
    const result = await this.redis.sismember(key, userId);
    return result === 1;
  }

  async getSurveyVoterCount(surveyId: string): Promise<number> {
    const key = `survey:${surveyId}:voters`;
    return await this.redis.scard(key);
  }

  async markSurveySubmitted(surveyId: string, userId: string): Promise<void> {
    const key = `survey:${surveyId}:voters`;
    await this.redis.sadd(key, userId);
  }

  async incrementQuestionOptionCount(
    questionId: string,
    optionId: string,
  ): Promise<void> {
    const resultKey = `question:${questionId}:result`;
    await this.redis.hincrby(resultKey, optionId, 1);
  }

  /**
   * Performs an anonymous survey submission for multiple questions.
   * Splits 'Who' (votersKey) from 'What' (resultsKey).
   */
  async performSurveySubmission(
    surveyId: string,
    userId: string,
    answers: { questionId: string; optionIds: string[]; hasOther?: boolean }[],
  ) {
    const hasSubmitted = await this.hasUserSubmittedSurvey(surveyId, userId);
    if (hasSubmitted) {
      throw new Error('User has already submitted this survey');
    }

    const votersKey = `survey:${surveyId}:voters`;
    const pipeline = this.redis.pipeline();

    // Mark user as submitted
    pipeline.sadd(votersKey, userId);

    // Process each question's answers
    answers.forEach(({ questionId, optionIds, hasOther }) => {
      const resultsKey = `survey:${surveyId}:results:${questionId}`;

      optionIds.forEach((optionId) => {
        pipeline.hincrby(resultsKey, optionId, 1);
      });

      if (hasOther) {
        pipeline.hincrby(resultsKey, 'OTHER_COUNT', 1);
      }
    });

    await pipeline.exec();
  }

  async getQuestionResults(
    surveyId: string,
    questionId: string,
  ): Promise<Record<string, string>> {
    const key = `survey:${surveyId}:results:${questionId}`;
    return await this.redis.hgetall(key);
  }

  async clearSurveyData(surveyId: string) {
    const votersKey = `survey:${surveyId}:voters`;
    const pattern = `survey:${surveyId}:results:*`;

    // Using scanning for results keys instead of keys() for safety
    const resultsKeys: string[] = [];
    let cursor = '0';
    do {
      const [newCursor, foundKeys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = newCursor;
      resultsKeys.push(...foundKeys);
    } while (cursor !== '0');

    const lockPattern = `survey_lock:${surveyId}:*`;
    const lockKeys: string[] = [];
    cursor = '0';
    do {
      const [newCursor, foundKeys] = await this.redis.scan(
        cursor,
        'MATCH',
        lockPattern,
        'COUNT',
        100,
      );
      cursor = newCursor;
      lockKeys.push(...foundKeys);
    } while (cursor !== '0');

    const pipeline = this.redis.pipeline();
    pipeline.del(votersKey);
    if (resultsKeys.length > 0) pipeline.del(...resultsKeys);
    if (lockKeys.length > 0) pipeline.del(...lockKeys);

    await pipeline.exec();
  }

  // ─── VOTING/SURVEY TOKEN METHODS ──────────────────────────────────────────────

  private tokenKey(
    type: 'voting' | 'survey',
    userId: string,
    entityId: string,
  ): string {
    return `token:${type}:${userId}:${entityId}`;
  }

  async issueToken(
    type: 'voting' | 'survey',
    userId: string,
    entityId: string,
    ttlSeconds = 3600,
  ): Promise<string> {
    const token = CryptoUtils.generateSecureToken();
    const hash = CryptoUtils.hashToken(token);
    await this.redis.set(
      this.tokenKey(type, userId, entityId),
      hash,
      'EX',
      ttlSeconds,
    );
    return token;
  }

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

  async consumeToken(
    type: 'voting' | 'survey',
    userId: string,
    entityId: string,
  ): Promise<void> {
    await this.redis.del(this.tokenKey(type, userId, entityId));
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

  async reissueToken(
    type: 'voting' | 'survey',
    userId: string,
    entityId: string,
    ttlSeconds = 3600,
  ): Promise<string> {
    await this.consumeToken(type, userId, entityId);
    return this.issueToken(type, userId, entityId, ttlSeconds);
  }
}
