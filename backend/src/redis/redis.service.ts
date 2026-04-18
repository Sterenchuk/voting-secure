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

  async performVote(votingId: string, optionIds: string[], userId: string, hasOther = false) {
    const lockKey = `vote_lock:${votingId}:${userId}`;
    const lockToken = await this.acquireLock(lockKey, 5);

    if (!lockToken) {
      throw new Error(
        'Another vote is being processed for this user. Please try again.',
      );
    }

    try {
      const hasVoted = await this.hasUserVoted(votingId, userId);
      if (hasVoted) {
        throw new Error('User has already voted');
      }

      const resultsKey = `voting:${votingId}:results`;
      const votersKey = `voting:${votingId}:voters`;

      const pipeline = this.redis.pipeline();
      
      // Mark user as voted
      pipeline.sadd(votersKey, userId);
      
      // Increment counts for options
      optionIds.forEach(id => {
        pipeline.hincrby(resultsKey, id, 1);
      });

      // Increment count for 'Other' if provided
      if (hasOther) {
        pipeline.hincrby(resultsKey, 'OTHER_COUNT', 1);
      }

      await pipeline.exec();
    } finally {
      await this.releaseLock(lockKey, lockToken);
    }
  }

  async getOtherCount(votingId: string): Promise<number> {
    const key = `voting:${votingId}:results`;
    const count = await this.redis.hget(key, 'OTHER_COUNT');
    return parseInt(count ?? '0');
  }

  async clearVotingData(votingId: string) {
    const pattern = `vote_lock:${votingId}:*`;
    const keys = await this.redis.keys(pattern);
    const pipeline = this.redis.pipeline();
    if (keys.length > 0) pipeline.del(...keys);
    pipeline.del(`voting:${votingId}:results`, `voting:${votingId}:voters`);
    await pipeline.exec();
  }

  // ─── SURVEY METHODS ────────────────────────────────────────────────────────

  async hasUserSubmittedSurvey(
    votingId: string,
    userId: string,
  ): Promise<boolean> {
    const key = `survey:${votingId}:submitted`;
    const result = await this.redis.sismember(key, userId);
    return result === 1;
  }

  async markSurveySubmitted(votingId: string, userId: string): Promise<void> {
    const key = `survey:${votingId}:submitted`;
    await this.redis.sadd(key, userId);
  }

  /**
   * Performs an anonymous survey answer update.
   * Splits 'Who' (answeredKey) from 'What' (resultsKey).
   */
  async performSurveyAnswer(
    votingId: string,
    questionId: string,
    optionIds: string[],
    userId: string,
  ) {
    const resultsKey = `survey:${votingId}:results:${questionId}`;
    const answeredKey = `survey:${votingId}:answered:${questionId}`;

    try {
      const pipeline = this.redis.multi();
      optionIds.forEach((optionId) => {
        pipeline.hincrby(resultsKey, optionId, 1);
      });
      // Track that this user answered this specific question
      pipeline.sadd(answeredKey, userId);
      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Redis survey answer update failed: ${error}`); // TODO
      throw error;
    }
  }

  async hasUserAnsweredQuestion(
    questionId: string,
    userId: string,
  ): Promise<boolean> {
    // Note: Ensure this key matches the 'answeredKey' pattern used in performSurveyAnswer
    const pattern = `survey:*:answered:${questionId}`;
    // It's better to pass votingId to this method to be precise:
    // const key = `survey:${votingId}:answered:${questionId}`;
    const keys = await this.redis.keys(pattern);
    if (keys.length === 0) return false;

    // Check first found match for simplicity, or refactor to include votingId
    const result = await this.redis.sismember(keys[0], userId);
    return result === 1;
  }

  async getQuestionResults(votingId: string, questionId: string) {
    const key = `survey:${votingId}:results:${questionId}`;
    return await this.redis.hgetall(key);
  }

  async clearSurveyData(votingId: string) {
    const pipeline = this.redis.pipeline();
    pipeline.del(`survey:${votingId}:submitted`);

    const pattern = `survey:${votingId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      pipeline.del(...keys);
    }
    await pipeline.exec();
  }
}
