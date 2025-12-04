import { Injectable } from '@nestjs/common';

import { DatabaseService } from 'src/database/database.service';
import { Voting } from '@prisma/client';

import { VotingCreateDto } from './dto/voting.create.dto';
import { VotingUpdateDto } from './dto/voting.update.dto';

import { handlePrismaError } from 'src/common/utils/prisma-error';
import { group } from 'console';
@Injectable()
export class VotingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createVoting(votingCreateDto: VotingCreateDto): Promise<Voting> {
    try {
      const { options, ...votingData } = votingCreateDto;
      const voting = await this.databaseService.voting.create({
        data: {
          ...votingData,
          options: {
            create: options.map((text) => ({ text })),
          },
        },
      });

      return voting;
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

      return await this.databaseService.voting.findMany({
        where,
      });
    } catch (e) {
      handlePrismaError(e, 'Finding votings');
    }
  }

  async findOne(id: string): Promise<Voting | null> {
    try {
      return await this.databaseService.voting.findUnique({
        where: { id },
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
          set: [], // cleat previous data
          create: votingUpdateDto.options.map((text: string) => ({ text })), // add new ones
        };
        delete updateData.options; // remove from the flat data if exists
      }

      return await this.databaseService.voting.update({
        where: { id },
        data: { ...updateData },
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
}
