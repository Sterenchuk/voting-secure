import { Test, TestingModule } from '@nestjs/testing';
import { VoteService } from './vote.service';
import { VotingsRepository } from './votings.repository';
import { RedisVotingService } from '../redis/redis.service';
import { VoteGateway } from './vote.gateway';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { SigningKeysService } from '../signing-keys/signing-keys.service';
import { CryptoUtils } from '../common/utils/crypto-utils';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { VotingType } from './types/voting.types';
import { BroadcastService } from '../broadcast/broadcast.service';
import { SocketEmitterService } from '../broadcast/socket-emitter.service';

process.env.TOKEN_HASH_SECRET = 'test-token-hash-secret';
process.env.BALLOT_SECRET = 'test-ballot-secret';
process.env.ENCRYPTION_KEYS =
  '0000000000000000000000000000000000000000000000000000000000000000';

describe('VoteService', () => {
  let service: VoteService;
  let repo: jest.Mocked<VotingsRepository>;
  let redis: jest.Mocked<RedisVotingService>;
  let usersService: jest.Mocked<UsersService>;
  let mailService: jest.Mocked<MailService>;
  let auditService: jest.Mocked<AuditService>;
  let signingKeys: jest.Mocked<SigningKeysService>;
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
            createParticipation: jest.fn(),
            createParticipationTx: jest.fn(),
            createBallotsTx: jest.fn(),
            createPendingBallot: jest.fn(),
            findPendingBallot: jest.fn(),
            deletePendingBallot: jest.fn(),
            findOptionsWithBallotCounts: jest.fn(),
            findVotingRaw: jest.fn(),
            findVotingResult: jest.fn(),
            countBallotsByVoting: jest.fn(),
            finalizeVoting: jest.fn(),
            findVotingAllowOther: jest.fn(),
            countAbstentions: jest.fn(),
            getParticipationStats: jest.fn(),
            updateVoting: jest.fn(),
          },
        },
        {
          provide: RedisVotingService,
          useValue: {
            acquireLock: jest.fn(),
            releaseLock: jest.fn(),
            performVote: jest.fn(),
            del: jest.fn(),
            setTemporaryReceipts: jest.fn(),
            getTemporaryReceipts: jest.fn(),
            getSnapshot: jest.fn(),
            setSnapshot: jest.fn(),
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
            sendVotingConfirmNotification: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AuditService,
          useValue: {
            appendChain: jest.fn().mockResolvedValue(undefined),
            verifyVotingChain: jest.fn(),
            getAuditStatus: jest.fn(),
            findBallotReceipt: jest.fn(),
          },
        },
        {
          provide: SigningKeysService,
          useValue: {
            ensureVotingKey: jest.fn(),
            getVotingKey: jest.fn(),
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
    signingKeys = module.get(SigningKeysService);
    gateway = module.get(VoteGateway);
    broadcastService = module.get(BroadcastService);
    socketEmitter = module.get(SocketEmitterService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const votingId = 'voting-1';
  const user = {
    id: 'user-1',
    email: 'user@example.com',
    language: 'en',
    theme: 'light',
  };
  const optionIds = ['opt-1'];
  const token = 'token-123';
  const signature = 'sig-123';

  const baseVoting = {
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
    broadcastInterval: 1,
    createdAt: new Date(),
  };

  const pendingBallot = (overrides: any = {}) => ({
    tokenHash: 'token-hash-1',
    userId: user.id,
    votingId,
    surveyId: null,
    isPractice: false,
    blindSig: 'blind-sig',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    ...overrides,
  });

  const signingKey = {
    publicKey: 'public-key',
    modulusHex: 'ab',
    exponentHex: '10001',
    keySize: 2048,
  };

  describe('signBlindedToken', () => {
    beforeEach(() => {
      jest.spyOn(CryptoUtils, 'hashToken').mockReturnValue('token-hash-1');
      jest.spyOn(CryptoUtils, 'signBlinded').mockReturnValue('blind-sig');
      signingKeys.ensureVotingKey.mockResolvedValue({
        ...signingKey,
        privateKey: 'private-key',
      });
    });

    it('should throw NotFoundException if voting not found', async () => {
      repo.findVotingById.mockResolvedValue(null);

      await expect(
        service.signBlindedToken(votingId, user, {
          token,
          blinded: 'blinded-1',
          optionIds,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if already participated', async () => {
      repo.findVotingById.mockResolvedValue(baseVoting as any);
      repo.findParticipation.mockResolvedValue({ id: 'p-1' } as any);

      await expect(
        service.signBlindedToken(votingId, user, {
          token,
          blinded: 'blinded-1',
          optionIds,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should issue a blind signature and store a pending ballot', async () => {
      repo.findVotingById.mockResolvedValue(baseVoting as any);
      repo.findParticipation.mockResolvedValue(null);
      repo.createPendingBallot.mockResolvedValue({} as any);
      repo.createParticipation.mockResolvedValue({} as any);
      auditService.appendChain.mockResolvedValue(undefined);

      const result = await service.signBlindedToken(votingId, user, {
        token,
        blinded: 'blinded-1',
        optionIds,
      });

      expect(CryptoUtils.signBlinded).toHaveBeenCalledWith(
        'blinded-1',
        'private-key',
      );
      expect(repo.createPendingBallot).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenHash: 'token-hash-1',
          userId: user.id,
          votingId,
          blindSig: 'blind-sig',
        }),
      );
      expect(repo.createParticipation).toHaveBeenCalledWith(user.id, votingId);
      expect(auditService.appendChain).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BLIND_SIGNATURE_ISSUED',
          userId: user.id,
        }),
      );
      expect(result).toEqual({
        blindSig: 'blind-sig',
        modulus: 'ab',
        exponent: '10001',
        keySize: 2048,
      });
    });

    it('should skip participation check and creation in practice mode', async () => {
      repo.findVotingById.mockResolvedValue(baseVoting as any);
      repo.createPendingBallot.mockResolvedValue({} as any);
      auditService.appendChain.mockResolvedValue(undefined);

      const result = await service.signBlindedToken(votingId, user, {
        token,
        blinded: 'blinded-1',
        optionIds,
        isPractice: true,
      });

      expect(repo.findParticipation).not.toHaveBeenCalled();
      expect(repo.createParticipation).not.toHaveBeenCalled();
      expect(result.blindSig).toBe('blind-sig');
    });
  });

  describe('vote', () => {
    beforeEach(() => {
      jest.spyOn(CryptoUtils, 'hashToken').mockReturnValue('token-hash-1');
      jest.spyOn(CryptoUtils, 'verifyBlindSignature').mockReturnValue(true);
      jest
        .spyOn(CryptoUtils, 'generateBallotReceipt')
        .mockReturnValue('receipt-hash');
      signingKeys.getVotingKey.mockResolvedValue(signingKey);
      redis.acquireLock.mockResolvedValue('lock-token');
      redis.performVote.mockResolvedValue(undefined as any);
      redis.del.mockResolvedValue(undefined);
      repo.findPendingBallot.mockResolvedValue(pendingBallot());
      repo.findVotingById.mockResolvedValue(baseVoting as any);
      repo.findOptionsWithBallotCounts.mockResolvedValue([]);
      repo.countAbstentions.mockResolvedValue(0);
      repo.createBallotsTx.mockResolvedValue({} as any);
      repo.deletePendingBallot.mockResolvedValue({} as any);
      auditService.appendChain.mockResolvedValue(undefined);
    });

    it('should throw ForbiddenException if lock cannot be acquired', async () => {
      redis.acquireLock.mockResolvedValue(null);

      await expect(
        service.vote(votingId, optionIds, user, token, signature),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if ballot token is invalid/expired', async () => {
      repo.findPendingBallot.mockResolvedValue(null);

      await expect(
        service.vote(votingId, optionIds, user, token, signature),
      ).rejects.toThrow('Invalid or expired ballot token');
      expect(redis.releaseLock).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for invalid blind signature', async () => {
      jest
        .spyOn(CryptoUtils, 'verifyBlindSignature')
        .mockReturnValue(false);

      await expect(
        service.vote(votingId, optionIds, user, token, signature),
      ).rejects.toThrow('Invalid blind signature');
    });

    it('should successfully cast a vote', async () => {
      repo.$transaction.mockImplementation((cb) =>
        cb({ option: { findFirst: jest.fn() } } as any),
      );

      const result = await service.vote(
        votingId,
        optionIds,
        user,
        token,
        signature,
      );

      expect(result.participated).toBe(true);
      expect(CryptoUtils.verifyBlindSignature).toHaveBeenCalledWith(
        token,
        signature,
        'public-key',
      );
      expect(repo.createBallotsTx).toHaveBeenCalled();
      expect(repo.deletePendingBallot).toHaveBeenCalledWith(
        'token-hash-1',
        expect.anything(),
      );
      expect(redis.performVote).toHaveBeenCalled();
      expect(auditService.appendChain).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BALLOT_CAST',
        }),
      );
      expect(mailService.sendVoteReceipt).toHaveBeenCalled();
    });

    it('should allow abstention with empty optionIds', async () => {
      repo.$transaction.mockImplementation((cb) =>
        cb({ option: { findFirst: jest.fn() } } as any),
      );

      const result = await service.vote(
        votingId,
        [],
        user,
        token,
        signature,
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
      await expect(
        service.vote(votingId, [], user, token, signature, undefined, false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should bypass DB and Audit Chain in practice mode', async () => {
      repo.findPendingBallot.mockResolvedValue(
        pendingBallot({ isPractice: true }),
      );

      const result = await service.vote(
        votingId,
        optionIds,
        user,
        token,
        signature,
        undefined,
        false,
        true,
      );

      expect(result.participated).toBe(true);
      expect(result.isPractice).toBe(true);
      expect(repo.$transaction).not.toHaveBeenCalled();
      expect(repo.createBallotsTx).not.toHaveBeenCalled();
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

      auditService.getAuditStatus.mockResolvedValue({
        isSecure: true,
        lastVerifiedSequence: 100,
      } as any);

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
