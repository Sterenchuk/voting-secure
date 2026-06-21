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
import { BroadcastService } from '../broadcast/broadcast.service';
import { SocketEmitterService } from '../broadcast/socket-emitter.service';

describe('VoteService', () => {
  let service: VoteService;
  let repo: jest.Mocked<VotingsRepository>;
  let redis: jest.Mocked<RedisVotingService>;
  let usersService: jest.Mocked<UsersService>;
  let mailService: jest.Mocked<MailService>;
  let auditService: jest.Mocked<AuditService>;
  let gateway: jest.Mocked<VoteGateway>;
  let broadcastService: jest.Mocked<BroadcastService>;
  let socketEmitter: jest.Mocked<SocketEmitterService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoteService,
        {
          provide: VotingsRepository,
          useValue: {
            $transaction: jest.fn((cb) =>
              cb({
                voting: { findUnique: jest.fn() },
                voteParticipation: { findUnique: jest.fn(), create: jest.fn() },
                ballot: { create: jest.fn() },
                option: { findFirst: jest.fn(), create: jest.fn() },
              }),
            ),
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
            countAbstentions: jest.fn(),
          },
        },
        {
          provide: RedisVotingService,
          useValue: {
            acquireLock: jest.fn(),
            releaseLock: jest.fn(),
            hasUserVoted: jest.fn(),
            performVote: jest.fn(),
            verifyToken: jest.fn(),
            consumeToken: jest.fn(),
            del: jest.fn(),
            setTemporaryReceipts: jest.fn(),
            getSnapshot: jest.fn(),
            setSnapshot: jest.fn(),
            setSelections: jest.fn(),
            getSelections: jest.fn(),
            deleteSelections: jest.fn(),
            lookupTokenByHash: jest.fn(),
            getStoredHash: jest.fn(),
            issueToken: jest.fn(),
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
            sendVoteReceipt: jest.fn().mockResolvedValue(undefined),
            sendVotingToken: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuditService,
          useValue: {
            appendChain: jest.fn().mockResolvedValue(undefined),
            verifyVotingChain: jest.fn(),
            getAuditStatus: jest.fn(),
          },
        },
        {
          provide: VoteGateway,
          useValue: {
            emitVotingResults: jest.fn(),
          },
        },
        {
          provide: BroadcastService,
          useValue: {
            broadcastVotingResults: jest.fn(),
            broadcastGlobalStats: jest.fn(),
          },
        },
        {
          provide: SocketEmitterService,
          useValue: {
            emitVotingResultsDirect: jest.fn(),
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
    broadcastService = module.get(BroadcastService);
    socketEmitter = module.get(SocketEmitterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('vote', () => {
    const votingId = 'voting-1';
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      language: 'en',
      theme: 'light',
    };
    const optionIds = ['opt-1'];
    const token = 'token-123';

    it('should throw ForbiddenException if lock cannot be acquired', async () => {
      redis.acquireLock.mockResolvedValue(null);

      await expect(
        service.vote(votingId, optionIds, user, token),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if user already voted (redis check)', async () => {
      redis.acquireLock.mockResolvedValue('lock-token');
      redis.hasUserVoted.mockResolvedValue(true);

      await expect(
        service.vote(votingId, optionIds, user, token),
      ).rejects.toThrow('Already participated');
      expect(redis.releaseLock).toHaveBeenCalled();
    });

    it('should successfully cast a vote', async () => {
      redis.acquireLock.mockResolvedValue('lock-token');
      redis.hasUserVoted.mockResolvedValue(false);

      const voting = {
        id: votingId,
        isFinalized: false,
        isPublic: true,
        groupId: 'group-1',
        title: 'Title',
        options: [{ id: 'opt-1' }],
        type: VotingType.SINGLE_CHOICE,
        minChoices: 1,
        maxChoices: 1,
        allowOther: false,
      };

      repo.findVotingById.mockResolvedValue(voting as any);
      redis.verifyToken.mockResolvedValue({ isPractice: false } as any);
      redis.getSnapshot.mockResolvedValue(null);
      repo.findOptionsWithBallotCounts.mockResolvedValue([]);
      repo.countAbstentions.mockResolvedValue(0);

      // Mock the transaction context
      repo.$transaction.mockImplementation((cb) =>
        cb({
          voteParticipation: { findUnique: jest.fn().mockResolvedValue(null) },
          option: { findFirst: jest.fn() },
        } as any),
      );

      // Setup audit mock to return a promise that resolves (since it's caught)
      auditService.appendChain.mockResolvedValue(undefined);

      const result = await service.vote(votingId, optionIds, user, token);

      expect(result.participated).toBe(true);
      expect(redis.verifyToken).toHaveBeenCalled();
      expect(redis.consumeToken).toHaveBeenCalled();
      expect(redis.performVote).toHaveBeenCalled();
      expect(auditService.appendChain).toHaveBeenCalled();
    });

    it('should allow abstention with empty optionIds', async () => {
      redis.acquireLock.mockResolvedValue('lock-token');
      redis.hasUserVoted.mockResolvedValue(false);
      redis.verifyToken.mockResolvedValue({ isPractice: false } as any);

      const voting = {
        id: votingId,
        isFinalized: false,
        isPublic: true,
        groupId: 'group-1',
        title: 'Title',
        options: [{ id: 'opt-1' }],
        type: VotingType.SINGLE_CHOICE,
        minChoices: 1,
        maxChoices: 1,
        allowOther: false,
      };

      repo.findVotingById.mockResolvedValue(voting as any);
      repo.findOptionsWithBallotCounts.mockResolvedValue([]);
      repo.countAbstentions.mockResolvedValue(0);
      redis.getSnapshot.mockResolvedValue(null);
      repo.$transaction.mockImplementation((cb) =>
        cb({
          voteParticipation: { findUnique: jest.fn().mockResolvedValue(null) },
          option: { findFirst: jest.fn() },
        } as any),
      );
      auditService.appendChain.mockResolvedValue(undefined);

      const result = await service.vote(
        votingId,
        [],
        user,
        token,
        undefined,
        true,
      );

      expect(result.participated).toBe(true);
      expect(redis.performVote).toHaveBeenCalledWith(
        votingId,
        [],
        user.id,
        true,
        false,
      );
    });

    it('should throw BadRequestException if empty optionIds and NOT abstention', async () => {
      redis.acquireLock.mockResolvedValue('lock-token');
      redis.hasUserVoted.mockResolvedValue(false);
      redis.verifyToken.mockResolvedValue({ isPractice: false } as any);

      const voting = {
        id: votingId,
        isFinalized: false,
        isPublic: true,
        groupId: 'group-1',
        title: 'Title',
        options: [{ id: 'opt-1' }],
        type: VotingType.SINGLE_CHOICE,
        minChoices: 1,
        maxChoices: 1,
        allowOther: false,
      };

      repo.findVotingById.mockResolvedValue(voting as any);

      await expect(
        service.vote(votingId, [], user, token, undefined, false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should bypass DB and Audit Chain in practice mode', async () => {
      redis.acquireLock.mockResolvedValue('lock-token');
      // In practice mode, we don't check hasUserVoted
      redis.verifyToken.mockResolvedValue({ isPractice: true } as any);

      const voting = {
        id: votingId,
        isFinalized: false,
        isPublic: true,
        groupId: 'group-1',
        title: 'Title',
        options: [{ id: 'opt-1' }],
        type: VotingType.SINGLE_CHOICE,
        minChoices: 1,
        maxChoices: 1,
        allowOther: false,
      };

      repo.findVotingById.mockResolvedValue(voting as any);

      const result = await service.vote(
        votingId,
        optionIds,
        user,
        token,
        undefined,
        false,
        true,
      );

      expect(result.participated).toBe(true);
      expect(result.isPractice).toBe(true);
      expect(repo.$transaction).not.toHaveBeenCalled();
      expect(auditService.appendChain).not.toHaveBeenCalled();
      expect(redis.performVote).toHaveBeenCalledWith(
        votingId,
        ['opt-1'],
        user.id,
        false,
        true,
      );
    });
  });

  describe('finalizeVoting', () => {
    const votingId = 'voting-1';
    const userId = 'admin-1';

    it('should throw ConflictException if already finalized', async () => {
      repo.findVotingRaw.mockResolvedValue({
        id: votingId,
        isFinalized: true,
      } as any);

      await expect(service.finalizeVoting(votingId, userId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should successfully finalize voting and verify chain', async () => {
      repo.findVotingRaw.mockResolvedValue({
        id: votingId,
        isFinalized: false,
        groupId: 'group-1',
      } as any);
      repo.findOptionsWithBallotCounts.mockResolvedValue([]);
      repo.countBallotsByVoting.mockResolvedValue(0);
      repo.finalizeVoting.mockResolvedValue({ id: 'result-1' } as any);

      auditService.getAuditStatus.mockResolvedValue({ isSecure: true, lastVerifiedSequence: 100 } as any);

      auditService.verifyVotingChain.mockResolvedValue({
        valid: true,
        totalChecked: 10,
        brokenAt: null,
        reason: null,
        scope: 'voting',
        scopeId: votingId,
      });

      const result = await service.finalizeVoting(votingId, userId);

      expect(repo.finalizeVoting).toHaveBeenCalled();
      expect(auditService.appendChain).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'VOTING_RESULT_SEALED',
        }),
      );
      expect(result.chainVerified).toBe(true);
    });
  });
});
