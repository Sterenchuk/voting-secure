import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { DatabaseService } from '../database/database.service';
import { Reflector } from '@nestjs/core';

describe('AuditController', () => {
  let controller: AuditController;

  const mockAuditService = {
    verifyChain: jest.fn(),
    verifyVotingChain: jest.fn(),
    verifySurveyChain: jest.fn(),
    getVotingChain: jest.fn(),
  };

  const mockDatabaseService = {
    voting: {
      findUnique: jest.fn(),
    },
    userGroup: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: mockAuditService,
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
