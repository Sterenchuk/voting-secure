import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Voting, Vote } from '@prisma/client';

import { VotingCreateDto } from './dto/voting.create.dto';
import { VotingUpdateDto } from './dto/voting.update.dto';
import { handlePrismaError } from 'src/common/utils/prisma-error';
import { SELECT_VOTING_RESULTS } from './dto/get.voting.results.dto';
import { VoteGateway } from './vote.gateway';

@Injectable()
export class VotingsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly voteGateway: VoteGateway,
  ) {}

  async create(votingCreateDto: VotingCreateDto): Promise<Voting> {
    try {
      const { options, ...votingData } = votingCreateDto;

      return await this.databaseService.voting.create({
        data: {
          ...votingData,
          options: {
            create: options.map((text) => ({ text })),
          },
        },
      });
    } catch (e) {
      handlePrismaError(e, 'Creating voting');
    }
  }

  async findAll(
    groupId?: string,
    title?: string,
    startAt?: Date,
    endAt?: Date,
  ): Promise<Voting[]> {
    try {
      const where: any = {};

      if (groupId) where.groupId = groupId;
      if (title) where.title = { contains: title, mode: 'insensitive' };
      if (startAt) where.startAt = { gte: startAt };
      if (endAt) where.endAt = { lte: endAt };

      return await this.databaseService.voting.findMany({ where });
    } catch (e) {
      handlePrismaError(e, 'Finding votings');
    }
  }

  async findOne(id: string): Promise<Voting | null> {
    try {
      return await this.databaseService.voting.findUnique({
        where: { id },
        include: {
          options: true,
        },
      });
    } catch (e) {
      handlePrismaError(e, 'Finding one voting');
    }
  }

  async update(id: string, votingUpdateDto: VotingUpdateDto): Promise<Voting> {
    try {
      const updateData: any = { ...votingUpdateDto };

      if (votingUpdateDto.options) {
        updateData.options = {
          deleteMany: {},
          create: votingUpdateDto.options.map((text: string) => ({ text })),
        };
      }

      return await this.databaseService.voting.update({
        where: { id },
        data: updateData,
        include: { options: true },
      });
    } catch (e) {
      handlePrismaError(e, 'Update voting');
    }
  }

  async delete(id: string) {
    try {
      await this.databaseService.voting.delete({
        where: { id },
      });
    } catch (e) {
      handlePrismaError(e, 'delete voting');
    }
  }

  async getVotingOptions(votingId: string) {
    return this.databaseService.option.findMany({
      where: { votingId },
    });
  }

  private async getVotingResults(votingId: string) {
    const results = await this.databaseService.option.findMany({
      where: {
        votingId,
      },
      select: {
        id: true,
        text: true,
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    return results.map((o) => ({
      optionId: o.id,
      text: o.text,
      votes: o._count.votes,
    }));
  }
  // TODO pass all exeption to prisma handler
  async vote(votingId: string, optionId: string, userId: string) {
    try {
      const vote = await this.databaseService.$transaction(async (tx) => {
        const voting = await tx.voting.findUnique({
          where: { id: votingId },
          include: { options: true },
        });

        if (!voting) throw new NotFoundException('Voting not found');

        const option = voting.options.find((o) => o.id === optionId);
        if (!option)
          throw new BadRequestException(
            'Option does not belong to this voting',
          );

        const now = new Date();

        if (voting.startAt && now < voting.startAt)
          throw new ForbiddenException('Voting has not started yet');

        if (voting.endAt && now > voting.endAt)
          throw new ForbiddenException('Voting has already ended');

        const member = await tx.userGroup.findUnique({
          where: {
            userId_groupId: {
              userId,
              groupId: voting.groupId,
            },
          },
        });

        if (!member) throw new ForbiddenException('You are not in this group');

        const alreadyVoted = await tx.vote.findUnique({
          where: {
            userId_optionId: {
              userId,
              optionId,
            },
          },
        });

        if (alreadyVoted)
          throw new ForbiddenException('You already voted for this option');

        return await tx.vote.create({
          data: {
            userId,
            optionId,
          },
        });
      });

      // ✅ EMIT SOCKET EVENTS
      this.voteGateway.emitVoteCast({
        votingId,
        optionId,
        userId,
      });

      const results = await this.getVotingResults(votingId);
      this.voteGateway.emitVotingResults(votingId, results);

      return vote;
    } catch (e) {
      handlePrismaError(e, 'Voting');
    }
  }
}
