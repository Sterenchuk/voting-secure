import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { SurveysRepository } from './surveys.repository';
import { GroupsService } from '../groups/groups.service';
import { RedisVotingService } from '../redis/redis.service';
import { SubmitGateway } from './submit.gateway';
import { AuditService } from '../audit/audit.service';
import { ChainAction } from '../audit/types/audit.types';
import { CryptoUtils } from '../common/utils/crypto-utils';
import { MailService } from '../mail/mail.service';
import {
  ISurveyBallotInput,
  ISurveyResults,
  IQuestionResult,
  SurveyQuestionType,
} from './types/survey.types';
import { UsersService } from '../users/users.service';
import { BroadcastService } from '../broadcast/broadcast.service';

@Injectable()
export class SubmitService {
  private readonly logger = new Logger(SubmitService.name);

  constructor(
    private readonly repo: SurveysRepository,
    private readonly groupService: GroupsService,
    private readonly redis: RedisVotingService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => SubmitGateway))
    private readonly gateway: SubmitGateway,
    private readonly usersService: UsersService,
    private readonly broadcastService: BroadcastService,
  ) {}

  async requestToken(
    surveyId: string,
    user: { id: string; email: string; language?: string; theme?: string },
    selections: {
      ballots: ISurveyBallotInput[];
      isPractice?: boolean;
      isAbstention?: boolean;
    },
  ) {
    const survey = await this.repo.findSurveyById(surveyId);
    if (!survey) throw new NotFoundException('Survey not found');

    if (!selections.isPractice) {
      const hasSubmitted = await this.redis.hasUserSubmittedSurvey(
        surveyId,
        user.id,
      );
      if (hasSubmitted)
        throw new ConflictException('Already participated in this survey');
    }

    const token = await this.redis.issueToken(
      'survey',
      user.id,
      surveyId,
      3600,
      selections.isPractice,
    );

    // Store full ballot payload for the email-confirmation flow via a single,
    // typed Redis method — no duplicate writes, no raw redis access.
    await this.redis.setSurveySelections(
      user.id,
      surveyId,
      {
        ballots: selections.ballots,
        isPractice: selections.isPractice,
        isAbstention: selections.isAbstention,
      },
      3600,
    );

    try {
      await this.auditService.appendChain({
        action: ChainAction.SURVEY_TOKEN_ISSUED,
        payload: {
          surveyId,
          expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
          isPractice: selections.isPractice,
          isAbstention: selections.isAbstention,
        },
        userId: user.id,
        surveyId,
        groupId: survey.groupId,
      });
    } catch (err) {
      this.logger.error(
        'Failed to write audit log for survey token request',
        err,
      );
    }

    if (selections.isPractice) {
      // For practice mode return the token directly so the caller can submit
      // without going through the email-confirmation flow.
      return { status: 'Success', token };
    }

    await this.mailService.sendSurveyToken(
      user.email,
      token,
      survey.title,
      surveyId,
      user.language ?? 'en',
      user.theme ?? 'light',
    );

    return { status: 'Success' };
  }

  async confirmSurveyFromEmail(surveyId: string, token: string) {
    const hash = CryptoUtils.hashToken(token);
    const meta = await this.redis.lookupTokenByHash(hash);

    if (!meta || meta.entityId !== surveyId || meta.type !== 'survey') {
      return { success: false, message: 'Invalid or expired token.' };
    }

    // Use the typed Redis method — no raw redis access needed.
    const selections = await this.redis.getSurveySelections(
      meta.userId,
      surveyId,
    );
    if (!selections) {
      return { success: false, message: 'Submission data not found.' };
    }

    const user = await this.usersService.findOne(meta.userId);
    if (!user) return { success: false, message: 'User not found.' };

    try {
      const result = await this.submitResponse(
        surveyId,
        user.id,
        selections.ballots,
        token,
        selections.isAbstention ?? false,
        selections.isPractice,
      );

      // Clean up stored selections now that the submission has been processed.
      await this.redis.deleteSurveySelections(user.id, surveyId);

      return { success: true, receipts: result.receipts };
    } catch (err) {
      this.logger.error(`Email confirmation for survey failed: ${err}`);
      return { success: false, message: err };
    }
  }

  async submitResponse(
    surveyId: string,
    userId: string,
    ballots: ISurveyBallotInput[],
    token?: string,
    isAbstention = false,
    isPractice = false,
  ) {
    const survey = await this.repo.findSurveyRawById(surveyId);
    if (!survey) throw new NotFoundException('Survey not found');
    if (survey.isFinalized) throw new ForbiddenException('Survey is finalized');

    if (!isPractice && !survey.isPublic)
      throw new ForbiddenException('Survey is closed');

    const now = new Date();
    if (!isPractice && survey.endAt && now > survey.endAt) {
      throw new ForbiddenException('Survey has ended');
    }

    if (!survey.isPublic) {
      await this.groupService.checkMembership(userId, survey.groupId);
    }

    if (!isPractice) {
      const alreadySubmitted = await this.redis.hasUserSubmittedSurvey(
        surveyId,
        userId,
      );
      if (alreadySubmitted) {
        throw new ForbiddenException('You have already submitted this survey');
      }
    }

    // ── Validation: Required questions and choice limits ───────────────────────
    if (!isAbstention) {
      for (const question of survey.questions) {
        const ballot = ballots.find((b) => b.questionId === question.id);
        const hasResponse =
          (ballot?.optionIds && ballot.optionIds.length > 0) ||
          (ballot?.text && ballot.text.trim().length > 0);

        if (question.isRequired && !hasResponse) {
          throw new BadRequestException(
            `Question "${question.text}" is required.`,
          );
        }

        if (
          hasResponse &&
          question.type === SurveyQuestionType.MULTIPLE_CHOICE &&
          question.choiceConfig
        ) {
          const selectedCount = ballot?.optionIds?.length || 0;
          const { minChoices, maxChoices } = question.choiceConfig;

          if (minChoices !== undefined && minChoices !== null && selectedCount < minChoices) {
            throw new BadRequestException(
              `Question "${question.text}" requires at least ${minChoices} choices.`,
            );
          }
          if (maxChoices !== undefined && maxChoices !== null && selectedCount > maxChoices) {
            throw new BadRequestException(
              `Question "${question.text}" allows at most ${maxChoices} choices.`,
            );
          }
        }
      }
    }

    let tokenHashed: string | undefined;
    let actualIsPractice = isPractice;

    if (token) {
      const tokenMeta = await this.redis.verifyToken(
        'survey',
        userId,
        surveyId,
        token,
      );
      tokenHashed = CryptoUtils.hashToken(token);
      actualIsPractice = tokenMeta.isPractice || isPractice;
    }

    const receipts: string[] = [];
    const dbBallots: {
      questionId: string;
      optionId: string;
      ballotHash: string;
      tokenHashed?: string;
    }[] = [];

    const redisAnswersMap = new Map<
      string,
      { optionIds: string[]; hasOther: boolean }
    >();

    for (const b of ballots) {
      const question = survey.questions.find((q) => q.id === b.questionId);
      if (!question) continue;

      if (!redisAnswersMap.has(b.questionId)) {
        redisAnswersMap.set(b.questionId, { optionIds: [], hasOther: false });
      }
      const qEntry = redisAnswersMap.get(b.questionId)!;

      if (b.optionIds && b.optionIds.length > 0) {
        for (const optId of b.optionIds) {
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              optId,
            );

          let finalOptionId = optId;
          if (!isUuid) {
            // SCALE or other dynamic value sent as ID
            finalOptionId = await this.repo.getOrCreateDynamicOption(
              b.questionId,
              optId,
            );
          } else {
            // Validate UUID belongs to this question
            const option = question.options.find((o) => o.id === optId);
            if (!option) {
              throw new BadRequestException(
                `Invalid option "${optId}" for question "${question.text}"`,
              );
            }
          }

          const receipt = CryptoUtils.generateBallotReceipt(
            surveyId,
            finalOptionId,
            tokenHashed || userId,
          );
          receipts.push(receipt);
          dbBallots.push({
            questionId: b.questionId,
            optionId: finalOptionId,
            ballotHash: receipt,
            tokenHashed,
          });
          qEntry.optionIds.push(finalOptionId);
        }
      }

      if (b.text) {
        // Freeform or 'Other' text
        const finalOptionId = await this.repo.getOrCreateDynamicOption(
          b.questionId,
          b.text,
        );
        const receipt = CryptoUtils.generateBallotReceipt(
          surveyId,
          finalOptionId,
          tokenHashed || userId,
        );
        receipts.push(receipt);
        dbBallots.push({
          questionId: b.questionId,
          optionId: finalOptionId,
          ballotHash: receipt,
          tokenHashed,
        });

        if (question.type === SurveyQuestionType.FREEFORM) {
          qEntry.optionIds.push(finalOptionId);
        } else {
          // It's an 'Other' response for a choice question
          qEntry.hasOther = true;
        }
      }
    }

    if (isAbstention) {
      const receipt = CryptoUtils.generateBallotReceipt(
        surveyId,
        'abstention',
        tokenHashed || userId,
      );
      receipts.push(receipt);
    }

    if (!actualIsPractice) {
      await this.repo.$transaction(async (tx) => {
        const existing = await this.repo.checkParticipation(userId, surveyId);
        if (existing) {
          throw new ForbiddenException(
            'You have already submitted this survey',
          );
        }

        await this.repo.addParticipation(tx, userId, surveyId);
        if (!isAbstention) {
          await this.repo.createBallotsTx(tx, surveyId, dbBallots);
        }
      });
    }

    const redisAnswers = Array.from(redisAnswersMap.entries()).map(
      ([questionId, data]) => ({
        questionId,
        optionIds: data.optionIds,
        hasOther: data.hasOther,
      }),
    );

    await this.redis.performSurveySubmission(
      surveyId,
      userId,
      redisAnswers,
      isAbstention,
      actualIsPractice,
    );

    if (token) {
      await this.redis.consumeToken('survey', userId, surveyId);
    }

    if (!actualIsPractice) {
      try {
        await this.redis.setTemporaryReceipts(surveyId, userId, receipts, 300);
      } catch (err) {
        this.logger.error(`Redis survey receipt cache update failed: ${err}`);
      }

      try {
        await this.auditService.appendChain({
          action: ChainAction.SURVEY_BALLOT_CAST,
          payload: {
            ballotHashes: receipts,
            tokenHashed,
            questionCount: ballots.length,
            isAbstention,
          },
          surveyId,
          groupId: survey.groupId,
        });
      } catch (err) {
        this.logger.error(
          `Audit chain write failed for SURVEY_BALLOT_CAST: ${err}`,
        );
      }

      // Fetch user via UsersService — no raw DB access via groupService.
      const user = await this.usersService.findOne(userId);
      if (user) {
        await this.mailService.sendVoteReceipt(
          user.email,
          survey.title,
          surveyId,
          receipts,
          user.language,
          user.theme,
        );
      }

      await this.broadcastLiveResults(
        surveyId,
        survey.questions.map((q) => q.id),
      );
    }

    return { success: true, receipts, isPractice: actualIsPractice };
  }

  broadcastResults(surveyId: string, results: ISurveyResults) {
    this.gateway.emitSurveyResults(surveyId, results);
  }

  async broadcastLiveResults(surveyId: string, questionIds: string[]) {
    await this.broadcastService.broadcastSurveyResults(surveyId, questionIds);
  }

  async getParticipationStats(surveyId: string) {
    const data = await this.repo.FindSurveyParticipation(surveyId);

    const stats: Record<string, number> = {};
    data.forEach((p) => {
      const date = new Date(p.createdAt);
      date.setSeconds(0);
      date.setMilliseconds(0);
      const key = date.toISOString();
      stats[key] = (stats[key] || 0) + 1;
    });

    return Object.entries(stats).map(([time, votes]) => ({ time, votes }));
  }

  async finalizeSurvey(surveyId: string, userId: string) {
    const survey = await this.repo.findSurveyRawById(surveyId);
    if (!survey) throw new NotFoundException('Survey not found');
    if (survey.isFinalized)
      throw new ConflictException('Survey is already finalized');

    if (survey.endAt && new Date() < new Date(survey.endAt)) {
      throw new ForbiddenException('Survey has not ended yet');
    }

    // Secure gate: Check audit status
    const auditStatus = await this.auditService.getAuditStatus('survey', surveyId);
    if (!auditStatus.isSecure) {
      throw new ForbiddenException(
        `Cannot finalize survey: Audit chain is not secure. ${auditStatus.reason || ''}`,
      );
    }

    const questionIds = survey.questions.map((q) => q.id);
    const results = await this.getResults(surveyId, questionIds);

    const tally = {
      results: results.results.map((r) => ({
        questionId: r.questionId,
        counts: Object.fromEntries(r.options.map((o) => [o.id, o.count])),
        otherCount: r.otherCount,
      })),
    };

    const totalResponses = results.totalResponses;
    const tallyHash = CryptoUtils.generateTallyHash(tally, totalResponses);

    // Encrypt tally for storage
    const encryptedTally = {
      encrypted: CryptoUtils.encrypt(JSON.stringify(tally)),
    };

    const result = await this.repo.$transaction((tx) =>
      this.repo.finalizeSurvey(tx, surveyId, encryptedTally, totalResponses, tallyHash),
    );

    try {
      await this.auditService.appendChain({
        action: ChainAction.SURVEY_RESULT_SEALED,
        payload: {
          tallyHash,
          totalResponses,
          chainVerified: true, // Known true because of secure gate
          chainBlocksChecked: auditStatus.lastVerifiedSequence,
        },
        surveyId,
        groupId: survey.groupId,
      });
    } catch (err) {
      this.logger.error(`Audit write failed for SURVEY_RESULT_SEALED: ${err}`);
    }

    return { ...result, tally, chainVerified: true };
  }

  async getUserSurveyStatus(surveyId: string, userId: string) {
    const participation = await this.repo.checkParticipation(userId, surveyId);
    if (!participation) return { submitted: false };

    const receipts = await this.redis.getTemporaryReceipts(surveyId, userId);
    return {
      submitted: true,
      receipts: receipts || undefined,
    };
  }

  async verifyReceipt(surveyId: string, hash: string | string[]) {
    const survey = await this.repo.findSurveyById(surveyId);
    if (!survey) throw new NotFoundException('Survey not found');
    return this.auditService.findBallotReceipt(surveyId, hash, 'survey');
  }

  async getSealedResult(surveyId: string) {
    const result = await this.repo.findSurveyResult(surveyId);
    if (!result)
      throw new NotFoundException('This survey has not been finalized yet');

    // Decrypt tally if encrypted
    if (result.tally && (result.tally as any).encrypted) {
      const decrypted = CryptoUtils.decrypt((result.tally as any).encrypted);
      try {
        result.tally = JSON.parse(decrypted);
      } catch (err) {
        this.logger.error(
          `Failed to parse decrypted tally for survey ${surveyId}`,
          err,
        );
      }
    }

    return result;
  }

  async getResults(
    surveyId: string,
    questionIds: string[],
    includeRawFreeForm = false,
  ): Promise<ISurveyResults> {
    const survey = await this.repo.findSurveyById(surveyId);
    if (survey?.isFinalized) {
      try {
        const sealed = await this.getSealedResult(surveyId);
        if (sealed && sealed.tally) {
          const tally = sealed.tally as any;
          const results: IQuestionResult[] = [];

          for (const qId of questionIds) {
            const qTally = tally.results?.find((r: any) => r.questionId === qId);
            const question = survey.questions.find((q) => q.id === qId);

            if (qTally && question) {
              const options = question.options.map((opt) => ({
                id: opt.id,
                text: opt.text,
                count: qTally.counts[opt.id] || 0,
              }));

              results.push({
                questionId: qId,
                options,
                otherCount: qTally.otherCount || 0,
              });
            }
          }
          return { surveyId, totalResponses: sealed.totalResponses, results };
        }
      } catch (err) {
        this.logger.warn(
          `Could not fetch sealed results for finalized survey ${surveyId}, falling back to live data.`,
        );
      }
    }
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
