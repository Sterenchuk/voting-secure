import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { AuditService } from '../src/audit/audit.service';
import { getModelToken } from '@nestjs/mongoose';
import { AuditChain } from '../src/audit/schemas/audit-chain.schema';
import { Model } from 'mongoose';
import { DatabaseService } from '../src/database/database.service';
import { RedisVotingService } from '../src/redis/redis.service';
import { ChainAction } from '../src/audit/types/audit.types';

describe('Audit Integrity (Advanced)', () => {
  let app: INestApplication;
  let auditService: AuditService;
  let chainModel: Model<AuditChain>;

  beforeAll(async () => {
    process.env.MONGO_URI = process.env.MONGO_URI?.replace('@mongo:', '@localhost:') || 
      'mongodb://audit_app:HueFqc31Dm8OcEueKbOlJyxE6NQn73uFHKkqDFaQJe7sUjcxUT@localhost:27017/audit';
    
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
    .overrideProvider(DatabaseService)
    .useValue({
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    })
    .overrideProvider(RedisVotingService)
    .useValue({
      nextGlobalSequence: jest.fn().mockResolvedValue(1),
      nextGroupSequence: jest.fn().mockResolvedValue(1),
      nextVotingSequence: jest.fn().mockResolvedValue(1),
      nextSurveySequence: jest.fn().mockResolvedValue(1),
      redis: {
        set: jest.fn().mockResolvedValue('OK'),
      },
    })
    .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    auditService = app.get<AuditService>(AuditService);
    chainModel = app.get<Model<AuditChain>>(getModelToken(AuditChain.name));
  }, 30000);

  beforeEach(async () => {
    await chainModel.deleteMany({});
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should detect inconsistent chain history (tampered hash)', async () => {
    // Insert a valid block manually (to control the initial hash)
    await chainModel.create({
      sequence: 1,
      action: ChainAction.BALLOT_CAST,
      payload: { a: 1 },
      createdAt: new Date(),
      prevHash: 'GENESIS',
      hash: 'tampered-hash-to-trigger-mismatch', // This is technically invalid but simulates a mismatch
    });

    const verification = await auditService.verifyChain(null, true);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('Hash mismatch');
    expect(verification.brokenAt).toBe(1);
  });
});
