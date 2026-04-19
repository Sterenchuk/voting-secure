import { Test, TestingModule } from '@nestjs/testing';
import { SurveysService } from './surveys.service';
import { SurveysRepository } from './surveys.repository';
import { GroupsService } from '../groups/groups.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SurveyQuestionType } from './types/survey.types';

describe('SurveysService', () => {
  let service: SurveysService;
  let repo: jest.Mocked<SurveysRepository>;
  let groupsService: jest.Mocked<GroupsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurveysService,
        {
          provide: SurveysRepository,
          useValue: {
            createSurvey: jest.fn(),
            findSurveys: jest.fn(),
            findSurveyById: jest.fn(),
            findSurveyRawById: jest.fn(),
            updateSurvey: jest.fn(),
            updateQuestion: jest.fn(),
            findQuestionById: jest.fn(),
            findOptionById: jest.fn(),
            addOption: jest.fn(),
            updateOption: jest.fn(),
            deleteOption: jest.fn(),
            softDeleteSurvey: jest.fn(),
            $transaction: jest.fn((cb) => cb({})),
          },
        },
        {
          provide: GroupsService,
          useValue: {
            checkAdminPermission: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SurveysService>(SurveysService);
    repo = module.get(SurveysRepository);
    groupsService = module.get(GroupsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const userId = 'user-1';
    const dto = {
      title: 'Survey 1',
      groupId: 'group-1',
      questions: [
        {
          text: 'Q1',
          type: SurveyQuestionType.SINGLE_CHOICE,
          options: [{ text: 'Opt 1' }],
        },
      ],
    };

    it('should throw BadRequestException if choice question has no options', async () => {
      const invalidDto = {
        ...dto,
        questions: [{ text: 'Q1', type: SurveyQuestionType.SINGLE_CHOICE, options: [] }],
      };
      await expect(service.create(userId, invalidDto as any)).rejects.toThrow(BadRequestException);
    });

    it('should auto-generate options for SCALE questions', async () => {
      const scaleDto = {
        ...dto,
        questions: [
          {
            text: 'Rate',
            type: SurveyQuestionType.SCALE,
            scaleConfig: { scaleMin: 1, scaleMax: 3, step: 1 },
          },
        ],
      };
      await service.create(userId, scaleDto as any);
      
      const expectedData = expect.objectContaining({
        surveyQuestions: expect.arrayContaining([
          expect.objectContaining({
            options: [
              { text: '1', order: 1 },
              { text: '2', order: 2 },
              { text: '3', order: 3 },
            ],
          }),
        ]),
      });
      expect(repo.createSurvey).toHaveBeenCalledWith(userId, expectedData);
    });

    it('should successfully create a survey', async () => {
      repo.createSurvey.mockResolvedValue({ id: 'survey-1' } as any);
      const result = await service.create(userId, dto as any);
      expect(result).toBeDefined();
      expect(groupsService.checkAdminPermission).toHaveBeenCalledWith(userId, dto.groupId);
    });
  });

  describe('updateQuestions', () => {
    const surveyId = 'survey-1';
    const userId = 'admin-1';
    const questions = [{ id: 'q-1', text: 'New Text' }];

    it('should throw ForbiddenException if survey is finalized', async () => {
      repo.findSurveyRawById.mockResolvedValue({ id: surveyId, isFinalized: true, groupId: 'g1' } as any);
      await expect(service.updateQuestions(userId, surveyId, questions as any)).rejects.toThrow(ForbiddenException);
    });

    it('should successfully update questions', async () => {
      repo.findSurveyRawById.mockResolvedValue({ id: surveyId, isFinalized: false, groupId: 'g1' } as any);
      repo.updateQuestion.mockResolvedValue({ id: 'q-1' } as any);
      
      const result = await service.updateQuestions(userId, surveyId, questions as any);
      expect(result).toHaveLength(1);
      expect(repo.updateQuestion).toHaveBeenCalled();
    });
  });

  describe('option management', () => {
    it('should throw NotFoundException in addOption if question missing', async () => {
      repo.findQuestionById.mockResolvedValue(null);
      await expect(service.addOption('q1', { text: 'opt' })).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException in updateOption if option missing', async () => {
      repo.findOptionById.mockResolvedValue(null);
      await expect(service.updateOption('o1', { text: 'opt' })).rejects.toThrow(NotFoundException);
    });
  });
});
