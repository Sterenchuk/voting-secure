import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { Worker } from 'bullmq';
import { AuditModule } from '../audit.module';
import { AuditService } from '../audit.service';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { AuditVerificationJob } from '../schemas/audit-verification-job.schema';
import { Model } from 'mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGO_URI'),
      }),
    }),
    AuditModule,
  ],
})
class VerificationWorkerModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    VerificationWorkerModule,
  );
  const auditService = app.get(AuditService);
  const jobModel = app.get<Model<AuditVerificationJob>>(
    getModelToken(AuditVerificationJob.name),
  );

  const worker = new Worker(
    'audit-verification',
    async (job) => {
      const { jobId, scope, scopeId, forceFull } = job.data;
      console.log(`[Worker] [${new Date().toISOString()}] >>> RECEIVED JOB: ${jobId} (Scope: ${scope}, ID: ${scopeId}, ForceFull: ${forceFull})`);
      
      await jobModel.findByIdAndUpdate(jobId, { status: 'processing', progress: 0 });

      const onProgress = async (progress: number) => {
        console.log(`[Worker] [${new Date().toISOString()}] Job ${jobId} progress: ${progress}%`);
        await jobModel.findByIdAndUpdate(jobId, { progress });
      };

      try {
        let result;
        if (scope === 'voting') {
          result = await auditService.verifyVotingChain(scopeId, !!forceFull, onProgress);
        } else if (scope === 'group') {
          result = await auditService.verifyGroupChain(scopeId, !!forceFull, onProgress);
        } else if (scope === 'survey') {
          result = await auditService.verifySurveyChain(scopeId, !!forceFull, onProgress);
        } else {
          result = await auditService.verifyChain(null, !!forceFull, onProgress);
        }

        console.log(`[Worker] [${new Date().toISOString()}] Job ${jobId} FINISHED successfully.`);
        await jobModel.findByIdAndUpdate(jobId, {
          status: 'completed',
          progress: 100,
          result,
        });
      } catch (err: any) {
        console.error(`[Worker] [${new Date().toISOString()}] Job ${jobId} FAILED: ${err.message}`);
        await jobModel.findByIdAndUpdate(jobId, {
          status: 'failed',
          error: err.message,
        });
      }
    },
    {
      connection: { host: process.env.REDIS_HOST || 'localhost', port: 6379 },
      concurrency: 1,
    },
  );

  console.log(`[Worker] [${new Date().toISOString()}] Audit Verification Worker is READY and listening for jobs on queue 'audit-verification'`);

  process.on('SIGTERM', async () => {
    await worker.close();
    await app.close();
  });
}
bootstrap();
