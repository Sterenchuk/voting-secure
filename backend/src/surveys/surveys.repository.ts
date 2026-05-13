import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  ICreateSurveyData,
  ISurveyWhereInput,
  ICreateSurveyQuestionData,
} from './types/survey.types';
import {
  SELECT_SURVEY_WITH_QUESTIONS,
  SELECT_SURVEY_QUESTIONS,
  SELECT_QUESTION_OPTIONS,
  SELECT_SURVEY_FOR_SUBMISSION,
  SELECT_SURVEY_BALLOT,
} from './types/select.fields';
import { PrismaTx } from '../database/database.service';

@Injectable()
export class SurveysRepository {
  constructor(private readonly db: DatabaseService) {}

  createSurvey(creatorId: string, data: ICreateSurveyData) {
    const { surveyQuestions, ...surveyFields } = data;
    return this.db.survey.create({
      data: {
        ...surveyFields,
        creatorId,
        questions: {
          create: surveyQuestions.map(
            ({ options, choiceConfig, scaleConfig, ...questionFields }) => {
              const { surveyId: _, ...fields } = questionFields as any;
              return {
                ...fields,
                choiceConfig: choiceConfig
                  ? { create: choiceConfig }
                  : undefined,
                scaleConfig: scaleConfig
                  ? { create: scaleConfig as any }
                  : undefined,
                options: {
                  create: options.map(({ text, ...optionFields }) => {
                    const { surveyQuestionId: __, ...optFields } =
                      optionFields as any;
                    return {
                      text,
                      ...optFields,
                    };
                  }),
                },
              };
            },
          ),
        },
      },
      select: SELECT_SURVEY_WITH_QUESTIONS,
    });
  }

  // ________________FIND_SURVEYS________________

  findSurveys(where: ISurveyWhereInput, userId?: string) {
    return this.db.survey.findMany({
      where: { ...where, deletedAt: null },
      select: {
        ...SELECT_SURVEY_WITH_QUESTIONS,
        _count: {
          select: { participations: true },
        },
        participations: userId
          ? {
              where: { userId },
              select: { id: true },
            }
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findSurveyById(surveyId: string, userId?: string) {
    return this.db.survey.findUnique({
      where: { id: surveyId, deletedAt: null },
      select: {
        ...SELECT_SURVEY_WITH_QUESTIONS,
        _count: {
          select: { participations: true },
        },
        participations: userId
          ? {
              where: { userId },
              select: { id: true },
            }
          : undefined,
      },
    });
  }

  findSurveyRawById(surveyId: string) {
    return this.db.survey.findUnique({
      where: { id: surveyId, deletedAt: null },
      include: {
        group: { include: { users: true } },
        questions: {
          include: { options: true, choiceConfig: true, scaleConfig: true },
        },
      },
    });
  }

  findSurveyForSubmiting(tx: PrismaTx, surveyId: string) {
    return tx.survey.findUnique({
      where: { id: surveyId, deletedAt: null },
      select: SELECT_SURVEY_FOR_SUBMISSION,
    });
  }

  async FindSurveyParticipation(surveyId: string) {
    return this.db.surveyParticipation.findMany({
      where: { surveyId },
      select: { createdAt: true },
    });
  }

  //__________________SURVEY_MUTATIONS________________

  async finalizeSurvey(
    tx: PrismaTx,
    surveyId: string,
    tally: any,
    totalResponses: number,
    tallyHash: string,
  ) {
    const finalizedAt = new Date();
    await tx.survey.update({
      where: { id: surveyId },
      data: { isFinalized: true, finalizedAt },
    });

    return tx.surveyResult.create({
      data: {
        surveyId,
        tally,
        totalResponses,
        tallyHash,
        sealedAt: finalizedAt,
      },
      select: {
        id: true,
        surveyId: true,
        totalResponses: true,
        tally: true,
        tallyHash: true,
        sealedAt: true,
      },
    });
  }

  updateSurvey(
    surveyId: string,
    data: Partial<ICreateSurveyData>,
    tx: PrismaTx = this.db,
  ) {
    return tx.survey.update({
      where: { id: surveyId, deletedAt: null },
      data,
      select: SELECT_SURVEY_WITH_QUESTIONS,
    });
  }

  softDeleteSurvey(surveyId: string, tx: PrismaTx = this.db) {
    return tx.survey.update({
      where: { id: surveyId },
      data: { deletedAt: new Date() },
    });
  }

  // _______________QUESTIONS/OPTIONS MUTATIONS________________
  findQuestionById(questionId: string) {
    return this.db.surveyQuestion.findUnique({
      where: { id: questionId },
      select: SELECT_SURVEY_QUESTIONS,
    });
  }

  addQuestion(
    surveyId: string,
    data: ICreateSurveyQuestionData,
    tx: PrismaTx = this.db,
  ) {
    const { options, choiceConfig, scaleConfig, ...fields } = data;
    const { surveyId: _, ...cleanFields } = fields as any;

    return tx.surveyQuestion.create({
      data: {
        ...cleanFields,
        surveyId,
        choiceConfig: choiceConfig ? { create: choiceConfig } : undefined,
        scaleConfig: scaleConfig ? { create: scaleConfig as any } : undefined,
        options: {
          create: options.map((opt) => ({
            text: opt.text,
            order: opt.order ?? 0,
          })),
        },
      },
      select: SELECT_SURVEY_QUESTIONS,
    });
  }

  updateQuestion(
    questionId: string,
    data: Partial<ICreateSurveyQuestionData>,
    tx: PrismaTx = this.db,
  ) {
    const { options, choiceConfig, scaleConfig, ...fields } = data;
    const { surveyId: _, ...cleanFields } = fields as any;

    return tx.surveyQuestion.update({
      where: { id: questionId },
      data: {
        ...cleanFields,
        choiceConfig: choiceConfig
          ? {
              upsert: {
                create: choiceConfig as any,
                update: choiceConfig,
              },
            }
          : undefined,
        scaleConfig: scaleConfig
          ? {
              upsert: {
                create: scaleConfig as any,
                update: scaleConfig,
              },
            }
          : undefined,
      },
      select: SELECT_SURVEY_QUESTIONS,
    });
  }

  deleteQuestion(questionId: string, tx: PrismaTx = this.db) {
    return tx.surveyQuestion.delete({
      where: { id: questionId },
    });
  }

  findOptionById(optionId: string) {
    return this.db.surveyOption.findUnique({
      where: { id: optionId },
      select: SELECT_QUESTION_OPTIONS,
    });
  }

  addOption(
    questionId: string,
    { text, order }: { text: string; order?: number },
    tx: PrismaTx = this.db,
  ) {
    return tx.surveyOption.create({
      data: { questionId, text, order },
      select: SELECT_QUESTION_OPTIONS,
    });
  }

  updateOption(
    optionId: string,
    { text, order }: { text?: string; order?: number },
    tx: PrismaTx = this.db,
  ) {
    return tx.surveyOption.update({
      where: { id: optionId },
      data: { text, ...(order !== undefined && { order }) },
      select: SELECT_QUESTION_OPTIONS,
    });
  }

  deleteOption(optionId: string, tx: PrismaTx = this.db) {
    return tx.surveyOption.delete({
      where: { id: optionId },
    });
  }

  // _______________FIND_QUESTIONS/OPTIONS________________

  findQuestionWithOptionsBySurvey(questionId: string) {
    return this.db.surveyQuestion.findUnique({
      where: { id: questionId },
      select: SELECT_SURVEY_QUESTIONS,
    });
  }

  findQuestionsBySurvey(surveyId: string) {
    return this.db.surveyQuestion.findMany({
      where: { surveyId },
      select: SELECT_SURVEY_QUESTIONS,
    });
  }

  findOptionsByQuestion(questionId: string) {
    return this.db.surveyOption.findMany({
      where: { questionId },
      select: SELECT_QUESTION_OPTIONS,
    });
  }

  // _______________SURVEY_PARTICIPATION________________

  checkParticipation(userId: string, surveyId: string) {
    return this.db.surveyParticipation.findUnique({
      where: {
        userId_surveyId: { userId, surveyId },
      },
    });
  }

  addParticipation(tx: PrismaTx, userId: string, surveyId: string) {
    return tx.surveyParticipation.create({
      data: { userId, surveyId },
    });
  }

  // _____________SURVEY BALLOTS________________

  createBallotsTx(
    tx: PrismaTx,
    surveyId: string,
    ballots: {
      questionId: string;
      optionId?: string;
      text?: string;
      ballotHash: string;
      tokenId?: string;
    }[],
  ) {
    return Promise.all(
      ballots.map(
        async ({ questionId, optionId, text, ballotHash, tokenId }) => {
          const question = await tx.surveyQuestion.findUnique({
            where: { id: questionId },
            select: { type: true },
          });

          if (!question) throw new Error(`Question ${questionId} not found`);

          if (question.type === 'FREEFORM') {
            return tx.surveyFreeformBallot.create({
              data: { questionId, text: text || '', ballotHash, tokenId },
              select: SELECT_SURVEY_BALLOT,
            });
          }

          let finalOptionId = optionId;

          // If optionId is provided but is not a UUID, it might be a SCALE value or 'OTHER'
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              optionId || '',
            );

          if (optionId && !isUuid) {
            const option = await tx.surveyOption.findFirst({
              where: { questionId, text: optionId },
            });
            if (option) {
              finalOptionId = option.id;
            } else {
              // Handle 'OTHER' or missing scale option
              let dynamicOption = await tx.surveyOption.findFirst({
                where: {
                  questionId,
                  text: text || optionId,
                  isDynamic: true,
                },
              });

              if (!dynamicOption) {
                dynamicOption = await tx.surveyOption.create({
                  data: {
                    questionId,
                    text: text || optionId,
                    isDynamic: true,
                  },
                });
              }
              finalOptionId = dynamicOption.id;
            }
          } else if (!optionId && text) {
            // Handle 'Other' for choice questions where optionId wasn't sent
            let dynamicOption = await tx.surveyOption.findFirst({
              where: { questionId, text, isDynamic: true },
            });

            if (!dynamicOption) {
              dynamicOption = await tx.surveyOption.create({
                data: { questionId, text, isDynamic: true },
              });
            }
            finalOptionId = dynamicOption.id;
          }

          if (finalOptionId) {
            return tx.surveyBallot.create({
              data: { questionId, optionId: finalOptionId, ballotHash, tokenId },
              select: SELECT_SURVEY_BALLOT,
            });
          }

          // Fallback to abstention or error?
          return tx.surveyBallot.create({
            data: { questionId, isAbstention: true, ballotHash, tokenId },
            select: SELECT_SURVEY_BALLOT,
          });
        },
      ),
    );
  }

  countBallotsByQuestion(questionId: string) {
    return this.db.surveyBallot.count({
      where: { questionId },
    });
  }

  findFreeformBallotsByQuestion(questionId: string) {
    return this.db.surveyFreeformBallot.findMany({
      where: { questionId },
    });
  }

  countBallotsByOption(optionId: string) {
    return this.db.surveyBallot.count({
      where: { optionId },
    });
  }

  async countTotalResponsesBySurvey(surveyId: string) {
    const [standardCount, freeformCount] = await Promise.all([
      this.db.surveyBallot.count({
        where: { question: { surveyId } },
      }),
      this.db.surveyFreeformBallot.count({
        where: { question: { surveyId } },
      }),
    ]);

    return standardCount + freeformCount;
  }

  // ___________FREFORM BALLOTS_________________

  countFreeformBallotsByQuestion(questionId: string) {
    return this.db.surveyFreeformBallot.count({
      where: { questionId },
    });
  }

  createFreeformBallotTx(
    tx: PrismaTx,
    data: {
      questionId: string;
      text: string;
      ballotHash: string;
      tokenId?: string;
    },
  ) {
    return tx.surveyFreeformBallot.create({
      data,
      select: SELECT_SURVEY_BALLOT,
    });
  }
  // _______________SURVEY_TOKENS________________

  async findSurveyToken(tx: PrismaTx, userId: string, surveyId: string) {
    const connection = tx || this.db;
    return connection.surveyToken.findUnique({
      where: { userId_surveyId: { userId, surveyId } },
      select: { id: true, tokenHash: true, used: true, expiresAt: true },
    });
  }

  async consumeSurveyToken(tx: PrismaTx, tokenId: string) {
    return tx.surveyToken.update({
      where: { id: tokenId },
      data: { used: true },
      select: { id: true },
    });
  }

  async createSurveyToken(data: {
    userId: string;
    surveyId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return this.db.surveyToken.upsert({
      where: {
        userId_surveyId: { userId: data.userId, surveyId: data.surveyId },
      },
      create: data,
      update: {
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        used: false,
      },
      select: { id: true, expiresAt: true },
    });
  }

  // transaction wrappers
  $transaction<T>(fn: (tx: PrismaTx) => Promise<T>): Promise<T> {
    return this.db.$transaction(fn);
  }
}
