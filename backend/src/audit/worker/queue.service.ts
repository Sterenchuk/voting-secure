import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditVerificationJob } from '../schemas/audit-verification-job.schema';

@Injectable()
export class AuditVerificationQueueService {
  private queue: Queue;

  constructor(
    @InjectModel(AuditVerificationJob.name)
    private readonly jobModel: Model<AuditVerificationJob>,
  ) {
    this.queue = new Queue('audit-verification', {
      connection: { host: process.env.REDIS_HOST || 'localhost', port: 6379 },
    });
  }

  async startVerification(scope: string, scopeId?: string, forceFull = false) {
    const jobRecord = await this.jobModel.create({
      status: 'pending',
      progress: 0,
      scope,
      scopeId,
    });

    await this.queue.add('verify-chain', {
      jobId: jobRecord._id,
      scope,
      scopeId,
      forceFull,
    });

    return jobRecord._id;
  }
}
