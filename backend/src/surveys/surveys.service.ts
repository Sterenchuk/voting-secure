import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SurveysRepository } from './surveys.repository';
import { GroupsService } from '../groups/groups.service';
import {
  FindSurveyQueryDto,
  SurveyCreateDto,
  SurveyUpdateDto,
} from './dto/survey.dto';
import {
  SurveyQuestionType,
  ICreateSurveyData,
  ISurveyWhereInput,
  ISurveyQuestion,
} from './types/survey.types';
import { UpdateSurveyQuestionDto } from './dto/question.dto';
import { SurveyOptionDto, UpdateSurveyOptionDto } from './dto/option.dto';

@Injectable()
export class SurveysService {
  constructor(
    private readonly repo: SurveysRepository,
    private readonly groupsService: GroupsService,
  ) {}

  // ─── Survey CRUD ─────────────────────────────────────────────────────────────

  async create(userId: string, dto: SurveyCreateDto) {
    await this.groupsService.checkAdminPermission(userId, dto.groupId);

    // Transform DTO to Repository Data structure
    const data: ICreateSurveyData = {
      title: dto.title,
      description: dto.description,
      groupId: dto.groupId,
      isOpen: dto.isOpen ?? false,
      endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      surveyQuestions: dto.questions.map((q) => {
        const question = {
          text: q.text,
          type: q.type,
          isRequired: q.isRequired ?? true,
          order: q.order ?? 0,
          choiceConfig: q.choiceConfig,
          scaleConfig: q.scaleConfig,
          options: q.options || [],
        };

        // Auto-generate options for SCALE questions if not provided
        if (
          q.type === SurveyQuestionType.SCALE &&
          question.options.length === 0
        ) {
          if (!q.scaleConfig) {
            throw new BadRequestException(
              `Scale configuration is required for question: "${q.text}"`,
            );
          }

          const { scaleMin, scaleMax, step = 1 } = q.scaleConfig;

          if (scaleMin >= scaleMax) {
            throw new BadRequestException(
              `scaleMin must be less than scaleMax for question: "${q.text}"`,
            );
          }

          for (let i = scaleMin; i <= scaleMax; i += step) {
            question.options.push({ text: i.toString(), order: i });
          }
        }

        // Validation: Choice questions MUST have options (unless they are freeform or scale handled above)
        if (
          (q.type === SurveyQuestionType.SINGLE_CHOICE ||
            q.type === SurveyQuestionType.MULTIPLE_CHOICE) &&
          question.options.length < 1
        ) {
          throw new BadRequestException(
            `Choice questions must have at least one option: "${q.text}"`,
          );
        }

        return question;
      }),
    };

    return this.repo.createSurvey(userId, data);
  }

  async findAll(dto: FindSurveyQueryDto) {
    const where: ISurveyWhereInput = { deletedAt: null };
    if (dto.groupId) where.groupId = dto.groupId;
    if (dto.title) where.title = { contains: dto.title, mode: 'insensitive' };
    if (dto.creatorId) where.creatorId = dto.creatorId;
    if (dto.isOpen !== undefined) where.isOpen = dto.isOpen;
    if (dto.isFinalized !== undefined) where.isFinalized = dto.isFinalized;

    return this.repo.findSurveys(where);
  }

  async findOne(id: string) {
    const survey = await this.repo.findSurveyById(id);
    if (!survey || (survey as any).deletedAt)
      throw new NotFoundException('Survey not found');
    return survey;
  }

  async update(userId: string, surveyId: string, dto: SurveyUpdateDto) {
    const survey = await this.repo.findSurveyRawById(surveyId);
    if (!survey || survey.deletedAt)
      throw new NotFoundException('Survey not found');

    await this.groupsService.checkAdminPermission(userId, survey.groupId);

    if (survey.isFinalized) {
      throw new ForbiddenException('Cannot update a finalized survey');
    }

    const updateData: Partial<ICreateSurveyData> = {
      title: dto.title,
      description: dto.description,
      isOpen: dto.isOpen,
      endAt: dto.endAt ? new Date(dto.endAt) : undefined,
    };

    return this.repo.updateSurvey(surveyId, updateData);
  }

  async updateQuestions(
    userId: string,
    surveyId: string,
    questions: UpdateSurveyQuestionDto[],
  ) {
    const survey = await this.repo.findSurveyRawById(surveyId);
    if (!survey || survey.deletedAt)
      throw new NotFoundException('Survey not found');

    await this.groupsService.checkAdminPermission(userId, survey.groupId);

    if (survey.isFinalized) {
      throw new ForbiddenException(
        'Cannot update questions of a finalized survey',
      );
    }

    return this.repo.$transaction(async (tx) => {
      const results: ISurveyQuestion[] = [];
      for (const q of questions) {
        const { id, ...data } = q;
        const updated = await this.repo.updateQuestion(id, data, tx);
        results.push(updated as any);
      }
      return results;
    });
  }

  async addOption(questionId: string, data: SurveyOptionDto) {
    if ((await this.repo.findQuestionById(questionId)) === null) {
      throw new NotFoundException('Question not found');
    }
    return this.repo.addOption(questionId, data);
  }

  async updateOption(optionId: string, data: UpdateSurveyOptionDto) {
    if ((await this.repo.findOptionById(optionId)) === null) {
      throw new NotFoundException('Option not found');
    }
    return this.repo.updateOption(optionId, data);
  }

  async deleteOption(optionId: string) {
    if ((await this.repo.findOptionById(optionId)) === null) {
      throw new NotFoundException('Option not found');
    }
    return this.repo.deleteOption(optionId);
  }

  async delete(userId: string, surveyId: string) {
    const survey = await this.repo.findSurveyRawById(surveyId);
    if (!survey || survey.deletedAt)
      throw new NotFoundException('Survey not found');

    await this.groupsService.checkAdminPermission(userId, survey.groupId);

    return await this.repo.softDeleteSurvey(surveyId);
  }
}
