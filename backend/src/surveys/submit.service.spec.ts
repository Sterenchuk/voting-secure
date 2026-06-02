import { Test, TestingModule } from '@nestjs/testing';
import { SubmitService } from './submit.service';
import { SurveysRepository } from './surveys.repository';
import { GroupsService } from '../groups/groups.service';
import { RedisVotingService } from '../redis/redis.service';
import { SubmitGateway } from './submit.gateway';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SurveyQuestionType } from './types/survey.types';

describe('SubmitService', () => {
  let service: SubmitService;
  let repo: jest.Mocked<SurveysRepository>;
  let groupService: jest.Mocked<GroupsService>;
  let redis: jest.Mocked<RedisVotingService>;
  let gateway: jest.Mocked<SubmitGateway>;

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
            addParticipation: jest.fn(),
            createBallotsTx: jest.fn(),
            countTotalResponsesBySurvey: jest.fn(),
            countBallotsByOption: jest.fn(),
            countFreeformBallotsByQuestion: jest.fn(),
            findFreeformBallotsByQuestion: jest.fn(),
            getOrCreateDynamicOption: jest.fn((qId, text) =>
              Promise.resolve(text),
            ),
            $transaction: jest.fn((cb) => cb({})),
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
            hasUserSubmittedSurvey: jest.fn(),
            performSurveySubmission: jest.fn(),
            getSurveyVoterCount: jest.fn(),
            getQuestionResults: jest.fn(),
            setTemporaryReceipts: jest.fn(),
            issueToken: jest.fn(),
            setSurveySelections: jest.fn(),
            consumeToken: jest.fn(),
            verifyToken: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            appendChain: jest.fn(),
            verifySurveyChain: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendVoteReceipt: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: SubmitGateway,
          useValue: {
            emitSurveyResults: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SubmitService>(SubmitService);
    repo = module.get(SurveysRepository);
    groupService = module.get(GroupsService);
    redis = module.get(RedisVotingService);
    gateway = module.get(SubmitGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('submitResponse', () => {
    const surveyId = 'survey-1';
    const userId = 'user-1';
    const ballots = [{ questionId: 'q-1', optionIds: ['opt-1'] }];

    it('should throw NotFoundException if survey does not exist', async () => {
      repo.findSurveyRawById.mockResolvedValue(null);
      await expect(
        service.submitResponse(surveyId, userId, ballots),
      ).rejects.toThrow(NotFoundException);
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

    it('should throw ForbiddenException if user already submitted (redis check)', async () => {
      repo.findSurveyRawById.mockResolvedValue({
        isPublic: true,
        isFinalized: false,
      } as any);
      redis.hasUserSubmittedSurvey.mockResolvedValue(true);
      await expect(
        service.submitResponse(surveyId, userId, ballots),
      ).rejects.toThrow('You have already submitted this survey');
    });

    it('should successfully submit a response', async () => {
      const survey = {
        id: surveyId,
        isPublic: true,
        isFinalized: false,
        groupId: 'group-1',
        questions: [{ id: 'q-1' }],
      };
      repo.findSurveyRawById.mockResolvedValue(survey as any);
      redis.hasUserSubmittedSurvey.mockResolvedValue(false);
      repo.checkParticipation.mockResolvedValue(null);

      // Mock getResults call that happens after submission
      redis.getQuestionResults.mockResolvedValue({ 'opt-1': '1' });
      redis.getSurveyVoterCount.mockResolvedValue(1);
      repo.findQuestionById.mockResolvedValue({
        options: [{ id: 'opt-1', text: 'Opt 1' }],
      } as any);

      const result = await service.submitResponse(surveyId, userId, ballots);

      expect(result.success).toBe(true);
      expect(repo.addParticipation).toHaveBeenCalled();
      expect(redis.performSurveySubmission).toHaveBeenCalled();
      expect(gateway.emitSurveyResults).toHaveBeenCalled();
    });

    it('should successfully submit a response with multiple optionIds', async () => {
      const survey = {
        id: surveyId,
        isPublic: true,
        isFinalized: false,
        groupId: 'group-1',
        questions: [{ id: 'q-2' }],
      };
      repo.findSurveyRawById.mockResolvedValue(survey as any);
      redis.hasUserSubmittedSurvey.mockResolvedValue(false);
      repo.checkParticipation.mockResolvedValue(null);

      const multiBallots = [
        {
          questionId: 'q-2',
          optionIds: ['opt-2-1', 'opt-2-2', 'opt-2-3'],
        },
      ];

      // Mock getResults call that happens after submission
      redis.getQuestionResults.mockResolvedValue({
        'opt-2-1': '1',
        'opt-2-2': '1',
        'opt-2-3': '1',
      });
      redis.getSurveyVoterCount.mockResolvedValue(1);
      repo.findQuestionById.mockResolvedValue({
        options: [
          { id: 'opt-2-1', text: 'Opt 2-1' },
          { id: 'opt-2-2', text: 'Opt 2-2' },
          { id: 'opt-2-3', text: 'Opt 2-3' },
        ],
      } as any);

      const result = await service.submitResponse(
        surveyId,
        userId,
        multiBallots,
      );

      expect(result.success).toBe(true);
      expect(result.receipts.length).toBe(3); // One receipt per option
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
  });

  describe('getResults', () => {
    const surveyId = 'survey-1';
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
