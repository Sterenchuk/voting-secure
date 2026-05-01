import { Test, TestingModule } from '@nestjs/testing';
import { VoteService } from './vote.service';
import { VotingsRepository } from './votings.repository';
import { RedisVotingService } from '../redis/redis.service';
import { VoteGateway } from './vote.gateway';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { VotingType } from './types/voting.types';

describe('VoteService', () => {
  let service: VoteService;
  let repo: jest.Mocked<VotingsRepository>;
  let redis: jest.Mocked<RedisVotingService>;
  let usersService: jest.Mocked<UsersService>;
  let mailService: jest.Mocked<MailService>;
  let auditService: jest.Mocked<AuditService>;
  let gateway: jest.Mocked<VoteGateway>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoteService,
        {
          provide: VotingsRepository,
          useValue: {
            $transaction: jest.fn((cb) => cb({
              voting: { findUnique: jest.fn() },
              voteParticipation: { findUnique: jest.fn(), create: jest.fn() },
              ballot: { create: jest.fn() },
              option: { findFirst: jest.fn(), create: jest.fn() },
            })),
            findVotingById: jest.fn(),
            findVotingForVote: jest.fn(),
            findParticipation: jest.fn(),
            createParticipationTx: jest.fn(),
            createBallotsTx: jest.fn(),
            findOptionsWithBallotCounts: jest.fn(),
            findVotingRaw: jest.fn(),
            findVotingResult: jest.fn(),
            countBallotsByVoting: jest.fn(),
            finalizeVoting: jest.fn(),
            findVotingAllowOther: jest.fn(),
          },
        },
        {
          provide: RedisVotingService,
          useValue: {
            acquireLock: jest.fn(),
            releaseLock: jest.fn(),
            hasUserVoted: jest.fn(),
            performVote: jest.fn(),
            getResults: jest.fn(),
            verifyToken: jest.fn(),
            consumeToken: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendVoteReceipt: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            appendChain: jest.fn(),
            verifyVotingChain: jest.fn(),
          },
        },
        {
          provide: VoteGateway,
          useValue: {
            emitVotingResults: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VoteService>(VoteService);
    repo = module.get(VotingsRepository);
    redis = module.get(RedisVotingService);
    usersService = module.get(UsersService);
    mailService = module.get(MailService);
    auditService = module.get(AuditService);
    gateway = module.get(VoteGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('vote', () => {
    const votingId = 'voting-1';
    const user = { id: 'user-1', email: 'user@example.com' };
    const ballots = [{ optionId: 'opt-1' }];
    const token = 'token-123';

    it('should throw ForbiddenException if lock cannot be acquired', async () => {
      redis.acquireLock.mockResolvedValue(null);

      await expect(service.vote(votingId, ballots, user, token)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user already voted (redis check)', async () => {
      redis.acquireLock.mockResolvedValue('lock-token');
      redis.hasUserVoted.mockResolvedValue(true);

      await expect(service.vote(votingId, ballots, user, token)).rejects.toThrow(
        'Already participated',
      );
      expect(redis.releaseLock).toHaveBeenCalled();
    });

    it('should successfully cast a vote', async () => {
      redis.acquireLock.mockResolvedValue('lock-token');
      redis.hasUserVoted.mockResolvedValue(false);
      
      const voting = {
        id: votingId,
        isFinalized: false,
        isOpen: true,
        groupId: 'group-1',
        title: 'Title',
        options: [{ id: 'opt-1' }],
        type: VotingType.SINGLE_CHOICE,
        minChoices: 1,
        maxChoices: 1,
        allowOther: false,
      };
      
      repo.findVotingForVote.mockResolvedValue(voting as any);
      
      // Mock the transaction context
      repo.$transaction.mockImplementation(async (cb) => {
        return cb({
          voteParticipation: { findUnique: jest.fn().mockResolvedValue(null) },
          option: { findFirst: jest.fn() }
        });
      });

      const result = await service.vote(votingId, ballots, user, token);

      expect(result.participated).toBe(true);
      expect(redis.verifyToken).toHaveBeenCalled();
      expect(redis.consumeToken).toHaveBeenCalled();
      expect(redis.performVote).toHaveBeenCalled();
      expect(auditService.appendChain).toHaveBeenCalled();
    });
  });

  describe('finalizeVoting', () => {
    const votingId = 'voting-1';
    const userId = 'admin-1';

    it('should throw ConflictException if already finalized', async () => {
      repo.findVotingRaw.mockResolvedValue({ id: votingId, isFinalized: true } as any);

      await expect(service.finalizeVoting(votingId, userId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should successfully finalize voting and verify chain', async () => {
      repo.findVotingRaw.mockResolvedValue({ id: votingId, isFinalized: false, groupId: 'group-1' } as any);
      repo.findOptionsWithBallotCounts.mockResolvedValue([]);
      repo.countBallotsByVoting.mockResolvedValue(0);
      repo.finalizeVoting.mockResolvedValue({ id: 'result-1' } as any);
      
      auditService.verifyVotingChain.mockResolvedValue({
        valid: true,
        totalChecked: 10,
        brokenAt: null,
        reason: null,
        scope: 'voting',
        scopeId: votingId
      });

      const result = await service.finalizeVoting(votingId, userId);

      expect(auditService.verifyVotingChain).toHaveBeenCalledWith(votingId);
      expect(repo.finalizeVoting).toHaveBeenCalled();
      expect(auditService.appendChain).toHaveBeenCalledWith(expect.objectContaining({
        action: 'VOTING_RESULT_SEALED'
      }));
      expect(result.chainVerified).toBe(true);
    });
  });
});
