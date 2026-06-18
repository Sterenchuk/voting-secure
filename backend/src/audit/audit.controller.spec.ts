import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditQueueService } from './worker/audit-queue.service';
import { getModelToken } from '@nestjs/mongoose';
import { AuditVerificationJob } from './schemas/audit-verification-job.schema';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../database/database.service';

describe('AuditController', () => {
  let controller: AuditController;

  const mockAuditService = {
    verifyChain: jest.fn(),
    verifyVotingChain: jest.fn(),
    verifySurveyChain: jest.fn(),
    getVotingChain: jest.fn(),
    searchChain: jest.fn(),
  };

  const mockAuditQueueService = {
    startVerification: jest.fn(),
    enqueueAppend: jest.fn(),
  };

  const mockJobModel = {
    findById: jest.fn(),
  };

  const mockDatabaseService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: AuditQueueService,
          useValue: mockAuditQueueService,
        },
        {
          provide: getModelToken(AuditVerificationJob.name),
          useValue: mockJobModel,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<AuditController>(AuditController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
