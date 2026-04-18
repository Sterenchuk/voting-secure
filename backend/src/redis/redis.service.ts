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

  async performVote(
    votingId: string,
    optionIds: string[],
    userId: string,
    hasOther = false,
  ) {
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
      optionIds.forEach((id) => {
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
    surveyId: string,
    userId: string,
  ): Promise<boolean> {
    const key = `survey:${surveyId}:voters`;
    const result = await this.redis.sismember(key, userId);
    return result === 1;
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
    const lockKey = `survey_lock:${surveyId}:${userId}`;
    const lockToken = await this.acquireLock(lockKey, 10);

    if (!lockToken) {
      throw new Error(
        'Another submission is being processed for this user. Please try again.',
      );
    }

    try {
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
    } finally {
      await this.releaseLock(lockKey, lockToken);
    }
  }

  async getQuestionResults(surveyId: string, questionId: string): Promise<Record<string, string>> {
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
      const [newCursor, foundKeys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = newCursor;
      resultsKeys.push(...foundKeys);
    } while (cursor !== '0');

    const lockPattern = `survey_lock:${surveyId}:*`;
    const lockKeys: string[] = [];
    cursor = '0';
    do {
      const [newCursor, foundKeys] = await this.redis.scan(cursor, 'MATCH', lockPattern, 'COUNT', 100);
      cursor = newCursor;
      lockKeys.push(...foundKeys);
    } while (cursor !== '0');

    const pipeline = this.redis.pipeline();
    pipeline.del(votersKey);
    if (resultsKeys.length > 0) pipeline.del(...resultsKeys);
    if (lockKeys.length > 0) pipeline.del(...lockKeys);
    
    await pipeline.exec();
  }
}
