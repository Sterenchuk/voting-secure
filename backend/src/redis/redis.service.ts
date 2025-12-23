import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisVotingService {
  private readonly logger = new Logger(RedisVotingService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  // --- Auth methods (unchanged) ---
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

  // --- FIXED: Proper distributed lock with unique token ---
  public async acquireLock(
    lockKey: string,
    ttlSeconds = 10,
  ): Promise<string | null> {
    // Generate highly unique token: timestamp + process.pid + random + counter
    const token = `${Date.now()}-${process.pid}-${Math.random().toString(36).substr(2, 15)}-${Math.floor(Math.random() * 1000000)}`;

    const result = await this.redis.set(lockKey, token, 'EX', ttlSeconds, 'NX');

    // Return the token if lock was acquired, null otherwise
    return result === 'OK' ? token : null;
  }

  public async releaseLock(lockKey: string, token: string): Promise<void> {
    // Only delete if the token matches (atomic check-and-delete)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    await this.redis.eval(script, 1, lockKey, token);
  }

  // FIXED: Simple Redis update, no locking here
  async performVote(votingId: string, optionId: string, userId: string) {
    const resultsKey = `vote:${votingId}:results`;
    const votersKey = `vote:${votingId}:voters`;

    try {
      const pipeline = this.redis.multi();
      pipeline.hincrby(resultsKey, optionId, 1);
      pipeline.sadd(votersKey, userId);
      await pipeline.exec();
    } catch (error) {
      console.error(`Redis vote update failed for user ${userId}:`, error);
      throw error;
    }
  }

  // --- Reliable voter check ---
  async hasUserVoted(votingId: string, userId: string): Promise<boolean> {
    const key = `vote:${votingId}:voters`;
    const result = await this.redis.sismember(key, userId);
    return result === 1;
  }

  async getResults(votingId: string) {
    const key = `vote:${votingId}:results`;
    return await this.redis.hgetall(key);
  }

  async clearVotingData(votingId: string) {
    const lockPattern = `vote_lock:${votingId}:*`;
    const lockKeys = await this.redis.keys(lockPattern);
    if (lockKeys.length > 0) {
      await this.redis.del(...lockKeys);
    }

    await this.redis.del(`vote:${votingId}:results`, `vote:${votingId}:voters`);
  }

  // --- Survey methods ---
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
      pipeline.sadd(answeredKey, userId);
      await pipeline.exec();
    } catch (error) {
      console.error(`Redis survey answer update failed:`, error);
      throw error;
    }
  }

  async hasUserAnsweredQuestion(
    questionId: string,
    userId: string,
  ): Promise<boolean> {
    const key = `survey:question:${questionId}:voters`;
    const result = await this.redis.sismember(key, userId);
    return result === 1;
  }

  async getQuestionResults(votingId: string, questionId: string) {
    const key = `survey:${votingId}:results:${questionId}`;
    return await this.redis.hgetall(key);
  }

  async clearSurveyData(votingId: string) {
    // Clear survey submission tracking
    await this.redis.del(`survey:${votingId}:submitted`);

    // Clear all question results and answered sets
    const pattern = `survey:${votingId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
