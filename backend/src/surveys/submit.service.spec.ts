import { Test, TestingModule } from '@nestjs/testing';
import { SubmitService } from './submit.service';
import { SurveysRepository } from './surveys.repository';
import { GroupsService } from '../groups/groups.service';
import { RedisVotingService } from '../redis/redis.service';
import { SubmitGateway } from './submit.gateway';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { SigningKeysService } from '../signing-keys/signing-keys.service';
import { CryptoUtils } from '../common/utils/crypto-utils';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { SurveyQuestionType } from './types/survey.types';
import { BroadcastService } from '../broadcast/broadcast.service';

process.env.TOKEN_HASH_SECRET = 'test-token-hash-secret';
process.env.BALLOT_SECRET = 'test-ballot-secret';

describe('SubmitService', () => {
  let service: SubmitService;
  let repo: jest.Mocked<SurveysRepository>;
  let groupService: jest.Mocked<GroupsService>;
  let redis: jest.Mocked<RedisVotingService>;
  let auditService: jest.Mocked<AuditService>;
  let mailService: jest.Mocked<MailService>;
  let usersService: jest.Mocked<UsersService>;
  let signingKeys: jest.Mocked<SigningKeysService>;
  let gateway: jest.Mocked<SubmitGateway>;
  let broadcastService: jest.Mocked<BroadcastService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmitService,
        {
          provide: SurveysRepository,
          useValue: {
            findSurveyRawById: jest.fn(),
            findSurveyById: jest.fn(),
            findQuestionById: jest.fn(),
            checkParticipation: jest.fn(),
            createParticipation: jest.fn(),
            createPendingBallot: jest.fn(),
            findPendingBallot: jest.fn(),
            deletePendingBallot: jest.fn(),
            createBallotsTx: jest.fn(),
            countTotalResponsesBySurvey: jest.fn(),
            countBallotsByOption: jest.fn(),
            countFreeformBallotsByQuestion: jest.fn(),
            findFreeformBallotsByQuestion: jest.fn(),
            getOrCreateDynamicOption: jest.fn((qId, text) =>
              Promise.resolve(text),
            ),
            $transaction: jest.fn((cb) => cb({})),
            FindSurveyParticipation: jest.fn(),
            findSurveyResult: jest.fn(),
            finalizeSurvey: jest.fn(),
            countBallotsByOptionCount: jest.fn(),
          },
        },
        {
          provide: GroupsService,
          useValue: {
            checkMembership: jest.fn(),
          },
        },
        {
          provide: RedisVotingService,
          useValue: {
            performSurveySubmission: jest.fn(),
            getSurveyVoterCount: jest.fn(),
            getQuestionResults: jest.fn(),
            setTemporaryReceipts: jest.fn(),
            getTemporaryReceipts: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            appendChain: jest.fn(),
            verifySurveyChain: jest.fn(),
            getAuditStatus: jest.fn(),
            findBallotReceipt: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendVoteReceipt: jest.fn().mockResolvedValue(undefined),
            sendSurveyConfirmNotification: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: SigningKeysService,
          useValue: {
            ensureSurveyKey: jest.fn(),
            getSurveyKey: jest.fn(),
          },
        },
        {
          provide: SubmitGateway,
          useValue: {
            emitSurveyResults: jest.fn(),
          },
        },
        {
          provide: BroadcastService,
          useValue: {
            broadcastSurveyResults: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SubmitService>(SubmitService);
    repo = module.get(SurveysRepository);
    groupService = module.get(GroupsService);
    redis = module.get(RedisVotingService);
    auditService = module.get(AuditService);
    mailService = module.get(MailService);
    usersService = module.get(UsersService);
    signingKeys = module.get(SigningKeysService);
    gateway = module.get(SubmitGateway);
    broadcastService = module.get(BroadcastService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const surveyId = 'survey-1';
  const userId = 'user-1';
  const user = { id: userId, email: 'user@example.com', language: 'en', theme: 'light' };
  const token = 'token-123';
  const signature = 'sig-123';

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
      signingKeys.ensureSurveyKey.mockResolvedValue({
        ...signingKey,
        privateKey: 'private-key',
      });
    });

    it('should throw NotFoundException if survey not found', async () => {
      repo.findSurveyById.mockResolvedValue(null);

      await expect(
        service.signBlindedToken(surveyId, user, {
          token,
          blinded: 'blinded-1',
          ballots: [],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if already participated', async () => {
      repo.findSurveyById.mockResolvedValue({
        id: surveyId,
        groupId: 'group-1',
      } as any);
      repo.checkParticipation.mockResolvedValue({ id: 'p-1' } as any);

      await expect(
        service.signBlindedToken(surveyId, user, {
          token,
          blinded: 'blinded-1',
          ballots: [],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should issue a blind signature and store a pending ballot', async () => {
      repo.findSurveyById.mockResolvedValue({
        id: surveyId,
        groupId: 'group-1',
      } as any);
      repo.checkParticipation.mockResolvedValue(null);
      repo.createPendingBallot.mockResolvedValue({} as any);
      repo.createParticipation.mockResolvedValue({} as any);
      auditService.appendChain.mockResolvedValue(undefined);

      const result = await service.signBlindedToken(surveyId, user, {
        token,
        blinded: 'blinded-1',
        ballots: [{ questionId: 'q-1', optionIds: ['opt-1'] }],
      });

      expect(CryptoUtils.signBlinded).toHaveBeenCalledWith(
        'blinded-1',
        'private-key',
      );
      expect(repo.createPendingBallot).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenHash: 'token-hash-1',
          userId,
          surveyId,
          blindSig: 'blind-sig',
        }),
      );
      expect(repo.createParticipation).toHaveBeenCalledWith(userId, surveyId);
      expect(auditService.appendChain).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BLIND_SIGNATURE_ISSUED',
          userId,
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
      repo.findSurveyById.mockResolvedValue({
        id: surveyId,
        groupId: 'group-1',
      } as any);
      repo.createPendingBallot.mockResolvedValue({} as any);
      auditService.appendChain.mockResolvedValue(undefined);

      const result = await service.signBlindedToken(surveyId, user, {
        token,
        blinded: 'blinded-1',
        ballots: [],
        isPractice: true,
      });

      expect(repo.checkParticipation).not.toHaveBeenCalled();
      expect(repo.createParticipation).not.toHaveBeenCalled();
      expect(result.blindSig).toBe('blind-sig');
    });
  });

  describe('submitResponse', () => {
    const ballots = [{ questionId: 'q-1', optionIds: ['opt-1'] }];

    const pendingBallot = (overrides: any = {}) => ({
      tokenHash: 'token-hash-1',
      userId,
      votingId: null,
      surveyId,
      isPractice: false,
      blindSig: 'blind-sig',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      ...overrides,
    });

    const baseSurvey = (questions: any[] = [{ id: 'q-1', options: [{ id: 'opt-1' }] }]) => ({
      id: surveyId,
      title: 'Survey',
      isPublic: true,
      isFinalized: false,
      groupId: 'group-1',
      questions,
    });

    beforeEach(() => {
      jest.spyOn(CryptoUtils, 'hashToken').mockReturnValue('token-hash-1');
      jest.spyOn(CryptoUtils, 'verifyBlindSignature').mockReturnValue(true);
      jest
        .spyOn(CryptoUtils, 'generateBallotReceipt')
        .mockReturnValue('receipt-hash');
      signingKeys.getSurveyKey.mockResolvedValue(signingKey);
      redis.performSurveySubmission.mockResolvedValue(undefined as any);
      repo.findPendingBallot.mockResolvedValue(pendingBallot());
      repo.createBallotsTx.mockResolvedValue({} as any);
      repo.deletePendingBallot.mockResolvedValue({} as any);
      auditService.appendChain.mockResolvedValue(undefined);
      usersService.findOne.mockResolvedValue(user as any);
      broadcastService.broadcastSurveyResults.mockResolvedValue(undefined as any);
    });

    it('should throw NotFoundException if survey does not exist', async () => {
      repo.findSurveyRawById.mockResolvedValue(null);
      await expect(
        service.submitResponse(surveyId, userId, ballots),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if survey is finalized', async () => {
      repo.findSurveyRawById.mockResolvedValue({
        isPublic: true,
        isFinalized: true,
      } as any);
      await expect(
        service.submitResponse(surveyId, userId, ballots),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if survey is closed', async () => {
      repo.findSurveyRawById.mockResolvedValue({
        isPublic: false,
        isFinalized: false,
      } as any);
      await expect(
        service.submitResponse(surveyId, userId, ballots),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException without a valid token+signature', async () => {
      repo.findSurveyRawById.mockResolvedValue(baseSurvey() as any);

      await expect(
        service.submitResponse(surveyId, userId, ballots),
      ).rejects.toThrow('A valid token and signature are required');
    });

    it('should throw ForbiddenException for an invalid/expired ballot token', async () => {
      repo.findSurveyRawById.mockResolvedValue(baseSurvey() as any);
      repo.findPendingBallot.mockResolvedValue(null);

      await expect(
        service.submitResponse(surveyId, userId, ballots, token, signature),
      ).rejects.toThrow('Invalid or expired survey token');
    });

    it('should throw ForbiddenException for an invalid blind signature', async () => {
      repo.findSurveyRawById.mockResolvedValue(baseSurvey() as any);
      jest.spyOn(CryptoUtils, 'verifyBlindSignature').mockReturnValue(false);

      await expect(
        service.submitResponse(surveyId, userId, ballots, token, signature),
      ).rejects.toThrow('Invalid blind signature');
    });

    it('should throw BadRequestException if a required question is missing', async () => {
      const survey = baseSurvey([
        { id: 'q-required', text: 'Required Q', isRequired: true },
      ]);
      repo.findSurveyRawById.mockResolvedValue(survey as any);

      await expect(
        service.submitResponse(surveyId, userId, [], token, signature),
      ).rejects.toThrow('Question "Required Q" is required.');
    });

    it('should throw BadRequestException if minChoices is not met', async () => {
      const survey = baseSurvey([
        {
          id: 'q-multi',
          text: 'Multi Q',
          type: SurveyQuestionType.MULTIPLE_CHOICE,
          isRequired: true,
          choiceConfig: { minChoices: 2, maxChoices: 5 },
        },
      ]);
      repo.findSurveyRawById.mockResolvedValue(survey as any);

      await expect(
        service.submitResponse(
          surveyId,
          userId,
          [{ questionId: 'q-multi', optionIds: ['opt-1'] }],
          token,
          signature,
        ),
      ).rejects.toThrow('Question "Multi Q" requires at least 2 choices.');
    });

    it('should throw BadRequestException if maxChoices is exceeded', async () => {
      const survey = baseSurvey([
        {
          id: 'q-multi',
          text: 'Multi Q',
          type: SurveyQuestionType.MULTIPLE_CHOICE,
          isRequired: true,
          choiceConfig: { minChoices: 1, maxChoices: 2 },
        },
      ]);
      repo.findSurveyRawById.mockResolvedValue(survey as any);

      await expect(
        service.submitResponse(
          surveyId,
          userId,
          [
            {
              questionId: 'q-multi',
              optionIds: ['opt-1', 'opt-2', 'opt-3'],
            },
          ],
          token,
          signature,
        ),
      ).rejects.toThrow('Question "Multi Q" allows at most 2 choices.');
    });

    it('should successfully submit a response', async () => {
      repo.findSurveyRawById.mockResolvedValue(baseSurvey() as any);

      const result = await service.submitResponse(
        surveyId,
        userId,
        ballots,
        token,
        signature,
      );

      expect(result.success).toBe(true);
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
      expect(redis.performSurveySubmission).toHaveBeenCalled();
      expect(auditService.appendChain).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SURVEY_BALLOT_CAST',
        }),
      );
      expect(broadcastService.broadcastSurveyResults).toHaveBeenCalled();
    });

    it('should successfully submit a response with multiple optionIds', async () => {
      const survey = baseSurvey([
        {
          id: 'q-2',
          options: [{ id: 'opt-2-1' }, { id: 'opt-2-2' }, { id: 'opt-2-3' }],
        },
      ]);
      repo.findSurveyRawById.mockResolvedValue(survey as any);

      const multiBallots = [
        {
          questionId: 'q-2',
          optionIds: ['opt-2-1', 'opt-2-2', 'opt-2-3'],
        },
      ];

      const result = await service.submitResponse(
        surveyId,
        userId,
        multiBallots,
        token,
        signature,
      );

      expect(result.success).toBe(true);
      expect(result.receipts.length).toBe(3);
      expect(repo.createBallotsTx).toHaveBeenCalledWith(
        expect.anything(),
        surveyId,
        expect.arrayContaining([
          expect.objectContaining({ optionId: 'opt-2-1' }),
          expect.objectContaining({ optionId: 'opt-2-2' }),
          expect.objectContaining({ optionId: 'opt-2-3' }),
        ]),
      );
    });

    it('should resolve raw SCALE values to UUIDs for Redis tracking', async () => {
      const scaleValue = '5';
      const resolvedUuid = 'uuid-for-5';
      const survey = baseSurvey([
        {
          id: 'q-scale',
          type: SurveyQuestionType.SCALE,
          options: [{ id: resolvedUuid, text: scaleValue }],
        },
      ]);
      repo.findSurveyRawById.mockResolvedValue(survey as any);
      repo.getOrCreateDynamicOption.mockResolvedValue(resolvedUuid);

      await service.submitResponse(
        surveyId,
        userId,
        [{ questionId: 'q-scale', optionIds: [scaleValue] }],
        token,
        signature,
      );

      expect(redis.performSurveySubmission).toHaveBeenCalledWith(
        surveyId,
        userId,
        expect.arrayContaining([
          expect.objectContaining({
            questionId: 'q-scale',
            optionIds: [resolvedUuid],
          }),
        ]),
        false,
        false,
      );
    });

    it('should allow practice submission without token and signature', async () => {
      repo.findSurveyRawById.mockResolvedValue(baseSurvey() as any);

      const result = await service.submitResponse(
        surveyId,
        userId,
        ballots,
        undefined,
        undefined,
        false,
        true,
      );

      expect(result.success).toBe(true);
      expect(result.isPractice).toBe(true);
      expect(repo.$transaction).not.toHaveBeenCalled();
      expect(auditService.appendChain).not.toHaveBeenCalled();
    });
  });

  describe('getResults', () => {
    const qId = 'q-1';

    it('should return results from Redis when available', async () => {
      redis.getQuestionResults.mockResolvedValue({
        'opt-1': '10',
        OTHER_COUNT: '2',
      });
      redis.getSurveyVoterCount.mockResolvedValue(12);
      repo.findQuestionById.mockResolvedValue({
        id: qId,
        options: [{ id: 'opt-1', text: 'Option 1' }],
      } as any);

      const results = await service.getResults(surveyId, [qId]);

      expect(results.totalResponses).toBe(12);
      expect(results.results[0].options[0].count).toBe(10);
      expect(results.results[0].otherCount).toBe(2);
    });

    it('should fall back to DB if Redis is empty', async () => {
      redis.getQuestionResults.mockResolvedValue({});
      redis.getSurveyVoterCount.mockResolvedValue(0);
      repo.countTotalResponsesBySurvey.mockResolvedValue(5);
      repo.findQuestionById.mockResolvedValue({
        id: qId,
        options: [{ id: 'opt-1', text: 'Option 1' }],
        choiceConfig: { allowOther: true },
      } as any);
      repo.countBallotsByOption.mockResolvedValue(3);
      repo.countFreeformBallotsByQuestion.mockResolvedValue(2);

      const results = await service.getResults(surveyId, [qId]);

      expect(results.totalResponses).toBe(5);
      expect(results.results[0].options[0].count).toBe(3);
      expect(results.results[0].otherCount).toBe(2);
    });
  });
});
