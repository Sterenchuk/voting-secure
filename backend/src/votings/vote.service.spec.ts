import { Test, TestingModule } from '@nestjs/testing';
import { VoteService } from './vote.service';
import { VotingsRepository } from './votings.repository';
import { RedisVotingService } from '../redis/redis.service';
import { VoteGateway } from './vote.gateway';
import { GroupsService } from '../groups/groups.service';
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
  let groupsService: jest.Mocked<GroupsService>;
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
              freeformBallot: { create: jest.fn() },
            })),
            findVotingForVote: jest.fn(),
            findParticipation: jest.fn(),
            createParticipationTx: jest.fn(),
            createBallotsTx: jest.fn(),
            createFreeformBallotTx: jest.fn(),
            findOptionsByVoting: jest.fn(),
            findOptionsWithBallotCounts: jest.fn(),
            countFreeformBallotsByVoting: jest.fn(),
            findFreeformBallotsByVoting: jest.fn(),
            findVotingRaw: jest.fn(),
            findVotingResult: jest.fn(),
            countBallotsByVoting: jest.fn(),
            finalizeVoting: jest.fn(),
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
          },
        },
        {
          provide: GroupsService,
          useValue: {
            checkMembership: jest.fn(),
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
    groupsService = module.get(GroupsService);
    gateway = module.get(VoteGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('vote', () => {
    const votingId = 'voting-1';
    const userId = 'user-1';
    const ballots = [{ optionId: 'opt-1', ballotHash: 'hash-1' }];

    it('should throw ForbiddenException if lock cannot be acquired', async () => {
      redis.acquireLock.mockResolvedValue(null);

      await expect(service.vote(votingId, ballots, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user already voted (redis check)', async () => {
      redis.acquireLock.mockResolvedValue('lock-token');
      redis.hasUserVoted.mockResolvedValue(true);

      await expect(service.vote(votingId, ballots, userId)).rejects.toThrow(
        'You have already participated in this voting',
      );
      expect(redis.releaseLock).toHaveBeenCalled();
    });

    it('should throw NotFoundException if voting does not exist', async () => {
      redis.acquireLock.mockResolvedValue('lock-token');
      redis.hasUserVoted.mockResolvedValue(false);
      repo.$transaction.mockImplementation(async (cb) => {
        return cb({ voting: { findUnique: jest.fn() } });
      });
      repo.findVotingForVote.mockResolvedValue(null);

      await expect(service.vote(votingId, ballots, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if voting is finalized', async () => {
      redis.acquireLock.mockResolvedValue('lock-token');
      redis.hasUserVoted.mockResolvedValue(false);
      repo.findVotingForVote.mockResolvedValue({ isFinalized: true } as any);

      await expect(service.vote(votingId, ballots, userId)).rejects.toThrow(
        'This voting has been finalized',
      );
    });

    it('should throw ForbiddenException if voting has not started', async () => {
      redis.acquireLock.mockResolvedValue('lock-token');
      redis.hasUserVoted.mockResolvedValue(false);
      const startAt = new Date();
      startAt.setFullYear(startAt.getFullYear() + 1);
      repo.findVotingForVote.mockResolvedValue({ isFinalized: false, startAt } as any);

      await expect(service.vote(votingId, ballots, userId)).rejects.toThrow(
        'Voting has not started yet',
      );
    });

    it('should throw ForbiddenException if voting has ended', async () => {
      redis.acquireLock.mockResolvedValue('lock-token');
      redis.hasUserVoted.mockResolvedValue(false);
      const endAt = new Date();
      endAt.setFullYear(endAt.getFullYear() - 1);
      repo.findVotingForVote.mockResolvedValue({ isFinalized: false, startAt: null, endAt } as any);

      await expect(service.vote(votingId, ballots, userId)).rejects.toThrow(
        'Voting has ended',
      );
    });

    it('should successfully cast a vote', async () => {
      redis.acquireLock.mockResolvedValue('lock-token');
      redis.hasUserVoted.mockResolvedValue(false);
      const voting = {
        id: votingId,
        isFinalized: false,
        isOpen: true,
        options: [{ id: 'opt-1' }],
        type: VotingType.SINGLE_CHOICE,
        minChoices: 1,
        maxChoices: 1,
        allowOther: false,
      };
      repo.findVotingForVote.mockResolvedValue(voting as any);
      repo.findParticipation.mockResolvedValue(null);
      repo.findVotingToken.mockResolvedValue({ id: 'token-1', used: false, expiresAt: new Date(Date.now() + 10000) } as any);
      repo.findOptionsWithBallotCounts.mockResolvedValue([{ id: 'opt-1', text: 'Opt 1', _count: { ballots: 1 } }] as any);

      const result = await service.vote(votingId, ballots, userId, 'token-1');

      expect(result.participated).toBe(true);
      expect(repo.createParticipationTx).toHaveBeenCalled();
      expect(repo.createBallotsTx).toHaveBeenCalled();
      expect(redis.performVote).toHaveBeenCalled();
      expect(gateway.emitVotingResults).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid option IDs', async () => {
      redis.acquireLock.mockResolvedValue('lock-token');
      redis.hasUserVoted.mockResolvedValue(false);
      const voting = {
        id: votingId,
        isFinalized: false,
        isOpen: true,
        options: [{ id: 'opt-1' }],
        type: VotingType.SINGLE_CHOICE,
        minChoices: 1,
        maxChoices: 1,
      };
      repo.findVotingForVote.mockResolvedValue(voting as any);
      
      const invalidBallots = [{ optionId: 'invalid-opt', ballotHash: 'hash' }];

      await expect(service.vote(votingId, invalidBallots, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getResults', () => {
    const votingId = 'voting-1';

    it('should return results from redis if available', async () => {
      redis.getResults.mockResolvedValue({ 'opt-1': '5', 'OTHER_COUNT': '2' });
      repo.findOptionsByVoting.mockResolvedValue([{ id: 'opt-1', text: 'Option 1' }] as any);
      repo.findVotingRaw.mockResolvedValue({ allowOther: true } as any);

      const results = await service.getResults(votingId);

      expect(results.options[0].voteCount).toBe(5);
      expect((results as any).otherCount).toBe(2);
      expect(results.totalBallots).toBe(7);
    });

    it('should return results from repo if not in redis', async () => {
      redis.getResults.mockResolvedValue(null);
      repo.findOptionsWithBallotCounts.mockResolvedValue([
        { id: 'opt-1', text: 'Option 1', _count: { ballots: 3 } }
      ] as any);
      repo.countFreeformBallotsByVoting.mockResolvedValue(1);
      repo.findVotingRaw.mockResolvedValue({ allowOther: true } as any);

      const results = await service.getResults(votingId);

      expect(results.options[0].voteCount).toBe(3);
      expect((results as any).otherCount).toBe(1);
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

    it('should successfully finalize voting', async () => {
      repo.findVotingRaw.mockResolvedValue({ id: votingId, isFinalized: false } as any);
      repo.findOptionsWithBallotCounts.mockResolvedValue([]);
      repo.countFreeformBallotsByVoting.mockResolvedValue(0);
      repo.countBallotsByVoting.mockResolvedValue(0);
      repo.finalizeVoting.mockResolvedValue({ id: 'result-1' } as any);

      const result = await service.finalizeVoting(votingId, userId);

      expect(repo.finalizeVoting).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});
