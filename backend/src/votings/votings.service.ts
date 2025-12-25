import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { VotingCreateDto, VotingType } from './dto/voting.create.dto';
import { VotingUpdateDto } from './dto/voting.update.dto';
import {
  VotingResponseDto,
  SELECT_VOTING_FIELDS,
  SELECT_VOTING_WITH_OPTIONS,
} from './dto/voting.response.dto';
import { FindVotingQueryDto } from './dto/find.voting.query.dto';
import {
  OptionResponseDto,
  SELECT_OPTION_FIELDS,
  SELECT_OPTION_WITH_VOTES,
} from './dto/option.response.dto';
import { handlePrismaError } from 'src/common/utils/prisma-error';
import { VoteGateway } from './vote.gateway';

import { RedisVotingService } from 'src/redis/redis.service';

@Injectable()
export class VotingsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisVotingService: RedisVotingService,
    @Inject(forwardRef(() => VoteGateway))
    private readonly voteGateway: VoteGateway,
  ) {}

  // --- CREATION LOGIC ---
  async create(dto: VotingCreateDto, userId: string) {
    try {
      this.validateVotingCreation(dto);
      const votingData: any = {
        title: dto.title,
        description: dto.description,
        groupId: dto.groupId,
        type: dto.type || VotingType.STANDARD,
        randomizerType: dto.randomizerType,
        isOpen: dto.isOpen,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        allowUserOptions: dto.allowUserOptions,
        optionsLockAt: dto.optionsLockAt
          ? new Date(dto.optionsLockAt)
          : undefined,
        allowMultiple: dto.allowMultiple,
        minChoices: dto.minChoices,
        maxChoices: dto.maxChoices,
        isSurvey: dto.isSurvey,
        showAggregateResults: dto.showAggregateResults,
        allowAnonymous: dto.allowAnonymous,
      };

      if (dto.type === VotingType.SURVEY && dto.questions) {
        return await this.createSurvey(votingData, dto.questions);
      } else if (dto.options) {
        votingData.options = {
          create: dto.options.map((text) => ({ text })),
        };
      }

      return await this.databaseService.voting.create({
        data: votingData,
        include: {
          options: true,
          questions: { include: { options: true } },
        },
      });
    } catch (e) {
      handlePrismaError(e, 'Creating voting');
    }
  }

  private validateVotingCreation(dto: VotingCreateDto) {
    if (
      dto.type === VotingType.SURVEY &&
      (!dto.questions || dto.questions.length === 0)
    ) {
      throw new BadRequestException('Survey must have at least one question');
    }

    const pollTypes = [
      VotingType.STANDARD,
      VotingType.FRIENDLY,
      VotingType.MULTIPLE_CHOICE,
    ];

    if (
      pollTypes.includes(dto.type as VotingType) &&
      (!dto.options || dto.options.length < 2)
    ) {
      throw new BadRequestException('Voting must have at least 2 options');
    }

    if (
      dto.type === VotingType.FRIENDLY &&
      dto.allowUserOptions &&
      !dto.optionsLockAt
    ) {
      throw new BadRequestException(
        'Friendly voting with user options must have optionsLockAt',
      );
    }
  }

  // --- READ LOGIC ---
  async findAll(forms: FindVotingQueryDto): Promise<VotingResponseDto[]> {
    try {
      const where: any = {};
      if (forms.groupId) where.groupId = forms.groupId;
      if (forms.title)
        where.title = { contains: forms.title, mode: 'insensitive' };
      if (forms.startAt) where.startAt = { gte: forms.startAt };
      if (forms.endAt) where.endAt = { lte: forms.endAt };
      if (forms.isOpen !== undefined) where.isOpen = forms.isOpen;

      return await this.databaseService.voting.findMany({
        where,
        select: {
          ...SELECT_VOTING_WITH_OPTIONS,
          options: {
            select: {
              id: true,
              text: true,
              addedBy: true,
              votingId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (e) {
      handlePrismaError(e, 'Finding votings');
    }
  }

  async findOne(id: string): Promise<any> {
    try {
      const voting = await this.databaseService.voting.findUnique({
        where: { id },
        include: {
          options: {
            include: { _count: { select: { votes: true } } },
          },
          questions: { include: { options: true } },
        },
      });

      if (!voting) throw new NotFoundException('Voting not found');

      return {
        ...voting,
        options: voting.options.map((opt) => ({
          ...opt,
          voteCount: opt._count.votes,
          _count: undefined,
        })),
      };
    } catch (e) {
      handlePrismaError(e, 'Finding one voting');
    }
  }

  async addOption(votingId: string, userId: string, optionText: string) {
    try {
      const voting = await this.databaseService.voting.findUnique({
        where: { id: votingId },
      });
      if (!voting) throw new NotFoundException('Voting not found');
      if (!voting.allowUserOptions)
        throw new ForbiddenException('User options not allowed');

      const now = new Date();
      if (voting.optionsLockAt && now >= voting.optionsLockAt)
        throw new ForbiddenException('Options are locked');
      if (voting.startAt && now >= voting.startAt)
        throw new ForbiddenException('Voting already started');

      const existing = await this.databaseService.option.findFirst({
        where: { text: optionText.trim(), votingId },
      });
      if (existing) throw new BadRequestException('Option already exists');

      const newOption = await this.databaseService.option.create({
        data: { text: optionText.trim(), votingId, addedBy: userId },
      });

      this.voteGateway.emitOptionAdded(votingId, newOption);
      return newOption;
    } catch (e) {
      handlePrismaError(e, 'Adding option');
    }
  }

  async updateOption(
    votingId: string,
    optionId: string,
    userId: string,
    optionText: string,
  ) {
    try {
      const option = await this.databaseService.option.findUnique({
        where: { id: optionId },
        include: { voting: true },
      });
      if (!option) throw new NotFoundException('Option not found');
      if (option.votingId !== votingId)
        throw new BadRequestException('Option does not belong to this voting');
      if (option.addedBy !== userId)
        throw new ForbiddenException('Can only edit your own options');

      const now = new Date();
      if (option.voting.startAt && now >= option.voting.startAt)
        throw new ForbiddenException('Cannot edit after voting has started');
      if (option.voting.endAt && now >= option.voting.endAt)
        throw new ForbiddenException('Cannot edit after voting has ended');

      const existing = await this.databaseService.option.findFirst({
        where: {
          text: optionText.trim(),
          votingId,
          id: { not: optionId },
        },
      });
      if (existing)
        throw new BadRequestException('Option with this text already exists');

      const updatedOption = await this.databaseService.option.update({
        where: { id: optionId },
        data: { text: optionText.trim() },
      });

      const results = await this.getVotingResults(votingId);
      this.voteGateway.emitVotingResults(votingId, results);
      return updatedOption;
    } catch (e) {
      handlePrismaError(e, 'Updating option');
    }
  }

  async deleteOption(votingId: string, optionId: string, userId: string) {
    try {
      const option = await this.databaseService.option.findUnique({
        where: { id: optionId },
      });
      if (!option || option.addedBy !== userId)
        throw new ForbiddenException('Cannot delete this option');

      const voting = await this.databaseService.voting.findUnique({
        where: { id: votingId },
      });
      if (voting?.startAt && new Date() >= voting.startAt)
        throw new ForbiddenException('Cannot delete after start');
      if (voting?.endAt && new Date() >= voting.endAt)
        throw new ForbiddenException('Cannot delete after end');

      await this.databaseService.option.delete({ where: { id: optionId } });

      // Emit option deleted event
      this.voteGateway.emitOptionDeleted(votingId, optionId);

      // Update everyone's live results
      const results = await this.getVotingResults(votingId);
      this.voteGateway.emitVotingResults(votingId, results);
    } catch (e) {
      handlePrismaError(e, 'Deleting option');
    }
  }

  async vote(votingId: string, optionIds: string[], userId: string) {
    const lockKey = `vote_lock:${votingId}:${userId}`;
    let lockToken: string | null = null;

    try {
      lockToken = await this.redisVotingService.acquireLock(lockKey, 15);
      if (!lockToken) {
        throw new ForbiddenException();
      }

      const alreadyVoted = await this.redisVotingService.hasUserVoted(
        votingId,
        userId,
      );
      if (alreadyVoted) {
        throw new ForbiddenException('Already voted (Redis Check)');
      }

      const result = await this.databaseService.$transaction(async (tx) => {
        const voting = await tx.voting.findUnique({
          where: { id: votingId },
          include: {
            options: { select: { id: true } },
            questions: { select: { id: true } },
          },
        });

        if (!voting) {
          throw new NotFoundException('Voting not found');
        }

        if (voting.isSurvey) {
          throw new BadRequestException(
            'This is a survey. Use the survey submission endpoint instead.',
          );
        }

        if (voting.options.length === 0) {
          throw new BadRequestException('This voting has no options.');
        }

        const validOptionIds = new Set(voting.options.map((opt) => opt.id));
        const invalidIds = optionIds.filter((id) => !validOptionIds.has(id));
        if (invalidIds.length > 0) {
          throw new BadRequestException(
            `Invalid option IDs: ${invalidIds.join(', ')}`,
          );
        }

        const uniqueOptionIds = [...new Set(optionIds)];

        if (!voting.allowMultiple && uniqueOptionIds.length > 1) {
          throw new BadRequestException(
            'Multiple selections are not allowed for this voting.',
          );
        }

        if (
          uniqueOptionIds.length < voting.minChoices ||
          (voting.maxChoices !== null &&
            uniqueOptionIds.length > voting.maxChoices)
        ) {
          throw new BadRequestException(
            `Must select between ${voting.minChoices} and ${
              voting.maxChoices ?? 'unlimited'
            } option(s).`,
          );
        }

        const now = new Date();
        if (voting.startAt && now < voting.startAt) {
          throw new ForbiddenException('Voting has not started yet.');
        }
        if (voting.endAt && now > voting.endAt) {
          throw new ForbiddenException('Voting has ended.');
        }
        if (!voting.isOpen) {
          const member = await tx.userGroup.findUnique({
            where: { userId_groupId: { userId, groupId: voting.groupId } },
          });
          if (!member) {
            throw new ForbiddenException('You are not a member of this group.');
          }
        }

        const existingVote = await tx.vote.findFirst({
          where: { userId, option: { votingId } },
        });
        if (existingVote) {
          throw new ForbiddenException('Already voted (DB Check)');
        }

        const createdVotes = await Promise.all(
          uniqueOptionIds.map((optionId) =>
            tx.vote.create({
              data: { userId, optionId },
            }),
          ),
        );

        return { votes: createdVotes, optionIds: uniqueOptionIds };
      });

      for (const optionId of result.optionIds) {
        await this.redisVotingService.performVote(votingId, optionId, userId);
      }

      const results = await this.getVotingResults(votingId);
      this.voteGateway.emitVotingResults(votingId, results);

      return result.votes;
    } catch (e) {
      if (
        e instanceof NotFoundException ||
        e instanceof BadRequestException ||
        e instanceof ForbiddenException
      ) {
        throw e;
      }
      handlePrismaError(e, 'Voting process');
      return;
    } finally {
      if (lockToken) {
        await this.redisVotingService.releaseLock(lockKey, lockToken);
      }
    }
  }

  async getUserVote(votingId: string, userId: string) {
    try {
      const hasVoted = await this.redisVotingService.hasUserVoted(
        votingId,
        userId,
      );
      console.log(`User ${userId} hasVoted check (Redis): ${hasVoted}`);
      if (!hasVoted) return {};

      const userVote = await this.databaseService.vote.findFirst({
        where: { userId, option: { votingId } },
      });
      return userVote ? { optionId: userVote.optionId } : {};
    } catch (e) {
      handlePrismaError(e, 'Getting user vote');
    }
  }

  async getVotingResults(votingId: string, tx?: any) {
    try {
      const cachedResults = await this.redisVotingService.getResults(votingId);

      if (cachedResults && Object.keys(cachedResults).length > 0) {
        const options = await this.databaseService.option.findMany({
          where: { votingId },
          select: { id: true, text: true, addedBy: true },
        });

        return options.map((o) => ({
          id: o.id,
          text: o.text,
          voteCount: parseInt(cachedResults[o.id] || '0'),
          addedBy: o.addedBy,
        }));
      }

      const prisma = tx || this.databaseService;
      const results = await prisma.option.findMany({
        where: { votingId },
        include: { _count: { select: { votes: true } } },
      });

      return results.map((o) => ({
        id: o.id,
        text: o.text,
        voteCount: o._count.votes,
        addedBy: o.addedBy,
      }));
    } catch (e) {
      handlePrismaError(e, 'Getting voting results');
    }
  }
  private async createSurvey(votingData: any, questions: any[]) {
    return await this.databaseService.voting.create({
      data: {
        ...votingData,
        questions: {
          create: questions.map((q, idx) => ({
            text: q.text,
            description: q.description,
            order: q.order ?? idx,
            allowMultiple: q.allowMultiple ?? false,
            options: {
              create: q.options.map((opt: any) => ({ text: opt.text })),
            },
          })),
        },
      },
      include: {
        questions: { include: { options: true }, orderBy: { order: 'asc' } },
      },
    });
  }

  async submitSurveyAnswer(
    votingId: string,
    answers: { questionId: string; optionIds: string[] }[],
    userId: string,
  ) {
    const lockKey = `survey_lock:${votingId}:${userId}`;
    let lockToken: string | null = null;

    try {
      // 1. Acquire distributed lock to prevent duplicate submissions
      lockToken = await this.redisVotingService.acquireLock(lockKey, 15);
      if (!lockToken) {
        throw new ForbiddenException('Survey submission already in progress');
      }

      // 2. Fast Redis pre-check for duplicate submissions
      const hasSubmitted = await this.redisVotingService.hasUserSubmittedSurvey(
        votingId,
        userId,
      );
      if (hasSubmitted) {
        throw new ForbiddenException('You have already submitted this survey');
      }

      // 3. Validate and submit in transaction
      const result = await this.databaseService.$transaction(async (tx) => {
        // Fetch survey with all questions and options in one query
        const voting = await tx.voting.findUnique({
          where: { id: votingId },
          include: {
            questions: {
              include: {
                options: { select: { id: true } },
              },
            },
          },
        });

        if (!voting) {
          throw new NotFoundException('Voting not found');
        }

        if (!voting.isSurvey) {
          throw new BadRequestException(
            'This is not a survey. Use the vote endpoint instead.',
          );
        }

        // Check survey timing
        const now = new Date();
        if (voting.startAt && now < voting.startAt) {
          throw new ForbiddenException('Survey has not started yet');
        }
        if (voting.endAt && now > voting.endAt) {
          throw new ForbiddenException('Survey has ended');
        }

        // Check access permissions
        if (!voting.isOpen) {
          const member = await tx.userGroup.findUnique({
            where: { userId_groupId: { userId, groupId: voting.groupId } },
          });
          if (!member) {
            throw new ForbiddenException('You are not a member of this group');
          }
        }

        // Check for existing answers (DB check)
        const existingAnswers = await tx.questionAnswer.findFirst({
          where: { userId, question: { votingId } },
        });

        if (existingAnswers) {
          throw new ForbiddenException('Already submitted (DB Check)');
        }

        // Validate all answers before creating any
        const validatedAnswers: {
          questionId: string;
          optionIds: string[];
          question: any;
        }[] = [];

        // Create a map of questions for O(1) lookup
        const questionMap = new Map(voting.questions.map((q) => [q.id, q]));

        // Validate that all submitted question IDs belong to this survey
        for (const { questionId, optionIds } of answers) {
          const question = questionMap.get(questionId);

          if (!question) {
            throw new BadRequestException(
              `Question ${questionId} does not belong to this survey`,
            );
          }

          // Validate option IDs
          const validOptionIds = new Set(question.options.map((o) => o.id));
          const invalidIds = optionIds.filter((id) => !validOptionIds.has(id));

          if (invalidIds.length > 0) {
            throw new BadRequestException(
              `Invalid option IDs for question "${question.text}": ${invalidIds.join(', ')}`,
            );
          }

          // Validate multiple choice rules
          const uniqueOptionIds = [...new Set(optionIds)];

          if (!question.allowMultiple && uniqueOptionIds.length > 1) {
            throw new BadRequestException(
              `Question "${question.text}" does not allow multiple answers`,
            );
          }

          if (uniqueOptionIds.length === 0) {
            throw new BadRequestException(
              `Question "${question.text}" requires at least one answer`,
            );
          }

          validatedAnswers.push({
            questionId,
            optionIds: uniqueOptionIds,
            question,
          });
        }

        // Check if all required questions are answered
        if (validatedAnswers.length !== voting.questions.length) {
          const answeredQuestionIds = new Set(
            validatedAnswers.map((a) => a.questionId),
          );
          const missingQuestions = voting.questions
            .filter((q) => !answeredQuestionIds.has(q.id))
            .map((q) => q.text);

          throw new BadRequestException(
            `Missing answers for questions: ${missingQuestions.join(', ')}`,
          );
        }

        // Create all answers in batch
        const answerData = validatedAnswers.flatMap(
          ({ questionId, optionIds }) =>
            optionIds.map((optionId) => ({
              userId,
              questionId,
              optionId,
            })),
        );

        const createdAnswers = await tx.questionAnswer.createMany({
          data: answerData,
        });

        return {
          answersCreated: createdAnswers.count,
          questionsAnswered: validatedAnswers.length,
        };
      });

      // 4. Transaction committed - Update Redis cache
      await this.redisVotingService.markSurveySubmitted(votingId, userId);

      // Update answer counts in Redis for each question/option
      for (const { questionId, optionIds } of answers) {
        await this.redisVotingService.performSurveyAnswer(
          votingId,
          questionId,
          optionIds,
          userId,
        );
      }

      // 5. Emit real-time results (if allowed)
      const voting = await this.databaseService.voting.findUnique({
        where: { id: votingId },
        select: { showAggregateResults: true },
      });

      if (voting?.showAggregateResults) {
        const results = await this.getSurveyResults(votingId);
        this.voteGateway.emitSurveyResults(votingId, results);
      }

      return result;
    } catch (e) {
      if (
        e instanceof NotFoundException ||
        e instanceof BadRequestException ||
        e instanceof ForbiddenException
      ) {
        throw e;
      }
      handlePrismaError(e, 'Submitting survey answers');
      return;
    } finally {
      if (lockToken) {
        await this.redisVotingService.releaseLock(lockKey, lockToken);
      }
    }
  }

  async getSurveyResults(votingId: string, requestingUserId?: string) {
    try {
      const voting = await this.databaseService.voting.findUnique({
        where: { id: votingId },
        include: {
          questions: {
            include: {
              options: {
                include: {
                  answers: {
                    include: { user: { select: { id: true, name: true } } },
                  },
                },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!voting?.isSurvey) throw new NotFoundException('Survey not found');

      const totalResponders = await this.getTotalSurveyResponses(votingId);

      return {
        votingId,
        title: voting.title,
        totalResponses: totalResponders,
        questions: voting.questions.map((q) => {
          const totalQuestionAnswers = q.options.reduce(
            (sum, o) => sum + o.answers.length,
            0,
          );
          return {
            questionId: q.id,
            text: q.text,
            options: q.options.map((opt) => ({
              optionId: opt.id,
              text: opt.text,
              responseCount: opt.answers.length,
              percentage:
                totalQuestionAnswers > 0
                  ? Math.round(
                      (opt.answers.length / totalQuestionAnswers) * 100,
                    )
                  : 0,
              respondents:
                voting.showAggregateResults && !voting.allowAnonymous
                  ? opt.answers.map((a) => ({
                      userId: a.user.id,
                      name: a.user.name,
                    }))
                  : undefined,
            })),
          };
        }),
      };
    } catch (e) {
      handlePrismaError(e, 'Getting survey results');
    }
  }

  private async getTotalSurveyResponses(votingId: string): Promise<number> {
    try {
      const uniqueUsers = await this.databaseService.questionAnswer.findMany({
        where: { question: { votingId } },
        distinct: ['userId'],
        select: { userId: true },
      });
      return uniqueUsers.length;
    } catch (e) {
      handlePrismaError(e, 'Getting total survey responses');
    }
  }

  async update(id: string, dto: VotingUpdateDto) {
    try {
      const { options, ...votingData } = dto;
      const updateData: any = { ...votingData };

      if (options) {
        updateData.options = {
          deleteMany: {},
          create: options.map((text: string) => ({ text })),
        };
      }

      return await this.databaseService.voting.update({
        where: { id },
        data: updateData,
        include: { options: true },
      });
    } catch (e) {
      handlePrismaError(e, 'Updating voting');
    }
  }

  async delete(id: string) {
    try {
      await this.databaseService.voting.delete({ where: { id } });
    } catch (e) {
      handlePrismaError(e, 'Deleting voting');
    }
  }
}
