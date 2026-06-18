import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AuditService } from './audit.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditVerificationJob } from './schemas/audit-verification-job.schema';

@Injectable()
@Processor('audit', { concurrency: 1 })
export class AuditProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditProcessor.name);

  constructor(
    private readonly auditService: AuditService,
    @InjectModel(AuditVerificationJob.name)
    private readonly jobModel: Model<AuditVerificationJob>,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing audit job: ${job.id} (${job.name})`);

    switch (job.name) {
      case 'append-chain':
        return this.handleAppendChain(job.data);
      case 'verify-chain':
        return this.handleVerifyChain(job.data);
      default:
        this.logger.warn(`No handler for audit job: ${job.name}`);
    }
  }

  private async handleAppendChain(data: any) {
    try {
      await this.auditService.processAppendInternal(data);
    } catch (err: any) {
      this.logger.error(`Append job FAILED: ${err.message}`);
      throw err;
    }
  }

  private async handleVerifyChain(data: any) {
    const { jobId, scope, scopeId, forceFull } = data;
    this.logger.log(`Processing verification job: ${jobId} [${scope}:${scopeId}]`);

    await this.jobModel.findByIdAndUpdate(jobId, {
      status: 'processing',
      progress: 0,
    });

    const onProgress = async (progress: number) => {
      await this.jobModel.findByIdAndUpdate(jobId, { progress });
    };

    try {
      let result;
      if (scope === 'voting') {
        result = await this.auditService.verifyVotingChain(
          scopeId,
          !!forceFull,
          onProgress,
        );
      } else if (scope === 'group') {
        result = await this.auditService.verifyGroupChain(
          scopeId,
          !!forceFull,
          onProgress,
        );
      } else if (scope === 'survey') {
        result = await this.auditService.verifySurveyChain(
          scopeId,
          !!forceFull,
          onProgress,
        );
      } else {
        result = await this.auditService.verifyChain(null, !!forceFull, onProgress);
      }

      await this.jobModel.findByIdAndUpdate(jobId, {
        status: 'completed',
        progress: 100,
        result,
      });
      return result;
    } catch (err: any) {
      this.logger.error(`Verification job ${jobId} FAILED: ${err.message}`);
      await this.jobModel.findByIdAndUpdate(jobId, {
        status: 'failed',
        error: err.message,
      });
      throw err;
    }
  }
}
