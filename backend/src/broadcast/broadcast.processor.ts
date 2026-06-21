import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { VoteService } from '../votings/vote.service';
import { SubmitService } from '../surveys/submit.service';
import { SocketEmitterService } from './socket-emitter.service';

@Injectable()
@Processor('broadcast')
export class BroadcastProcessor extends WorkerHost {
  private readonly logger = new Logger(BroadcastProcessor.name);

  constructor(
    @Inject(forwardRef(() => VoteService))
    private readonly voteService: VoteService,
    @Inject(forwardRef(() => SubmitService))
    private readonly submitService: SubmitService,
    private readonly socketEmitter: SocketEmitterService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing broadcast job: ${job.id} (${job.name})`);

    switch (job.name) {
      case 'broadcast-voting-results':
        return this.handleVotingBroadcast(job.data);
      case 'broadcast-survey-results':
        return this.handleSurveyBroadcast(job.data);
      case 'broadcast-global-stats':
        return this.handleGlobalStatsBroadcast();
      default:
        this.logger.warn(`No handler for broadcast job: ${job.name}`);
    }
  }

  private async handleVotingBroadcast(data: { votingId: string }) {
    try {
      this.logger.debug(`Fetching fresh results for voting: ${data.votingId}`);
      const results = await this.voteService.getResults(data.votingId, false, true);
      
      this.logger.debug(`Broadcasting voting results for ${data.votingId}`);
      this.socketEmitter.emit('/votings', `voting:${data.votingId}`, 'voting:results', {
        votingId: data.votingId,
        results,
      });

      return { success: true, votingId: data.votingId };
    } catch (err: any) {
      this.logger.error(`Voting broadcast job FAILED for ${data.votingId}: ${err.message}`);
      throw err;
    }
  }

  private async handleSurveyBroadcast(data: { surveyId: string; questionIds: string[] }) {
    try {
      this.logger.debug(`Fetching fresh results for survey: ${data.surveyId}`);
      const results = await this.submitService.getResults(data.surveyId, data.questionIds);
      
      this.logger.debug(`Broadcasting survey results for ${data.surveyId}`);
      this.socketEmitter.emit('/surveys', `survey:${data.surveyId}`, 'survey:results', {
        surveyId: data.surveyId,
        results,
      });

      return { success: true, surveyId: data.surveyId };
    } catch (err: any) {
      this.logger.error(`Survey broadcast job FAILED for ${data.surveyId}: ${err.message}`);
      throw err;
    }
  }

  private async handleGlobalStatsBroadcast() {
    try {
      this.logger.debug('Broadcasting global stats');
      // Fetch stats here directly since worker has access to services
      const stats = await (this.voteService as any).redis.getGlobalStats();
      const trends = await (this.voteService as any).redis.getGlobalTrends();
      
      this.socketEmitter.emitGlobal('/votings', 'global:stats', { stats, trends });
      return { success: true };
    } catch (err: any) {
      this.logger.error(`Global stats broadcast job FAILED: ${err.message}`);
      throw err;
    }
  }
}
