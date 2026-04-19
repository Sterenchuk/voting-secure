import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SurveysRepository } from './surveys.repository';
import { GroupsService } from '../groups/groups.service';
import { RedisVotingService } from '../redis/redis.service';
import { SubmitGateway } from './submit.gateway';
import {
  ISurveyBallotInput,
  ISurveyResults,
  IQuestionResult,
  SurveyQuestionType,
} from './types/survey.types';

@Injectable()
export class SubmitService {
  constructor(
    private readonly repo: SurveysRepository,
    private readonly groupService: GroupsService,
    private readonly redis: RedisVotingService,
    @Inject(forwardRef(() => SubmitGateway))
    private readonly gateway: SubmitGateway,
  ) {}

  async submitResponse(
    surveyId: string,
    userId: string,
    ballots: ISurveyBallotInput[],
  ) {
    const survey = await this.repo.findSurveyRawById(surveyId);
    if (!survey) throw new NotFoundException('Survey not found');
    if (!survey.isOpen) throw new ForbiddenException('Survey is closed');
    if (survey.isFinalized) throw new ForbiddenException('Survey is finalized');

    const now = new Date();
    if (survey.endAt && now > survey.endAt) {
      throw new ForbiddenException('Survey has ended');
    }

    await this.groupService.checkMembership(userId, survey.groupId);

    const alreadySubmitted = await this.redis.hasUserSubmittedSurvey(
      surveyId,
      userId,
    );
    if (alreadySubmitted) {
      throw new ForbiddenException('You have already submitted this survey');
    }

    await this.repo.$transaction(async (tx) => {
      const existing = await this.repo.checkParticipation(userId, surveyId);
      if (existing) {
        throw new ForbiddenException('You have already submitted this survey');
      }

      await this.repo.addParticipation(tx, userId, surveyId);
      await this.repo.createBallotsTx(
        tx,
        ballots.map((b) => ({
          questionId: b.questionId,
          optionId: b.optionId,
          text: b.text,
          ballotHash: b.ballotHash,
        })),
      );
    });

    const redisAnswers = ballots.map((b) => ({
      questionId: b.questionId,
      optionIds: b.optionId ? [b.optionId] : [],
      hasOther: !!b.text && !b.optionId,
    }));

    await this.redis.performSurveySubmission(surveyId, userId, redisAnswers);

    const results = await this.getResults(
      surveyId,
      survey.questions.map((q) => q.id),
    );
    this.gateway.emitSurveyResults(surveyId, results);

    return { success: true };
  }

  async getResults(
    surveyId: string,
    questionIds: string[],
    includeRawFreeForm = false,
  ): Promise<ISurveyResults> {
    const redisResults = await Promise.all(
      questionIds.map((id) => this.redis.getQuestionResults(surveyId, id)),
    );

    let totalResponses = await this.redis.getSurveyVoterCount(surveyId);
    if (totalResponses === 0) {
      totalResponses = await this.repo.countTotalResponsesBySurvey(surveyId);
    }

    const questionResults: IQuestionResult[] = [];

    for (let i = 0; i < questionIds.length; i++) {
      const qId = questionIds[i];
      const cached = redisResults[i];
      const question = await this.repo.findQuestionById(qId);
      if (!question) continue;

      const qResult: IQuestionResult = {
        questionId: qId,
        options: question.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          count: parseInt(cached?.[opt.id] ?? '0'),
        })),
      };

      if (cached?.['OTHER_COUNT']) {
        qResult.otherCount = parseInt(cached['OTHER_COUNT']);
      }

      if (Object.keys(cached || {}).length === 0 && totalResponses > 0) {
        for (const opt of qResult.options) {
          opt.count = await this.repo.countBallotsByOption(opt.id);
        }
        if (question.choiceConfig?.allowOther) {
          qResult.otherCount =
            await this.repo.countFreeformBallotsByQuestion(qId);
        }
      }

      if (includeRawFreeForm && question.type === SurveyQuestionType.FREEFORM) {
        const freeform = await this.repo.findFreeformBallotsByQuestion(qId);
        qResult.freeformAnswers = freeform.map((f) => f.text);
      }

      questionResults.push(qResult);
    }

    return { surveyId, totalResponses, results: questionResults };
  }
}
