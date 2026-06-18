import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(@InjectQueue('broadcast') private readonly broadcastQueue: Queue) {}

  /**
   * Enqueue a job to broadcast updated results for a voting.
   * Uses sharded jobId to debounce updates per voting.
   */
  async broadcastVotingResults(votingId: string) {
    try {
      await this.broadcastQueue.add(
        'broadcast-voting-results',
        { votingId },
        {
          jobId: `broadcast-voting-${votingId}`, // Debounce
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to enqueue voting broadcast for ${votingId}: ${err.message}`,
      );
    }
  }

  /**
   * Enqueue a job to broadcast updated results for a survey.
   * Uses sharded jobId to debounce updates per survey.
   */
  async broadcastSurveyResults(surveyId: string, questionIds: string[]) {
    try {
      await this.broadcastQueue.add(
        'broadcast-survey-results',
        { surveyId, questionIds },
        {
          jobId: `broadcast-survey-${surveyId}`, // Debounce
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to enqueue survey broadcast for ${surveyId}: ${err.message}`,
      );
    }
  }

  /**
   * Enqueue a job to broadcast global system stats.
   */
  async broadcastGlobalStats() {
    try {
      await this.broadcastQueue.add(
        'broadcast-global-stats',
        {},
        {
          jobId: 'broadcast-global-stats', // Debounce
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch (err: any) {
      this.logger.error(`Failed to enqueue global stats broadcast: ${err.message}`);
    }
  }
}
