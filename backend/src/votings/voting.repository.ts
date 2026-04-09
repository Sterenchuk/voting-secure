import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

export const SELECT_VOTING_WITH_OPTIONS = {
  id: true,
  title: true,
  description: true,
  type: true,
  randomizerType: true,
  isOpen: true,
  startAt: true,
  endAt: true,
  groupId: true,
  allowMultiple: true,
  minChoices: true,
  maxChoices: true,
  options: {
    select: {
      id: true,
      text: true,
    },
  },
};

@Injectable()
export class VotingRepository {
  constructor(private readonly prisma: DatabaseService) {}

  async create(data: any) {
    return this.prisma.voting.create({
      data,
      include: { options: true },
    });
  }

  async findAll(where: any) {
    return this.prisma.voting.findMany({
      where,
      select: SELECT_VOTING_WITH_OPTIONS,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, tx?: any) {
    const client = tx || this.prisma;
    return client.voting.findUnique({
      where: { id },
      include: {
        options: {
          include: { _count: { select: { votes: true } } },
        },
      },
    });
  }

  async findOptionById(optionId: string) {
    return this.prisma.option.findUnique({
      where: { id: optionId },
      include: { voting: true },
    });
  }

  async createOption(votingId: string, text: string) {
    return this.prisma.option.create({
      data: { text: text.trim(), votingId },
    });
  }

  async updateOption(optionId: string, text: string) {
    return this.prisma.option.update({
      where: { id: optionId },
      data: { text: text.trim() },
    });
  }

  async deleteOption(optionId: string) {
    return this.prisma.option.delete({ where: { id: optionId } });
  }

  async findExistingVote(userId: string, votingId: string, tx: any) {
    return tx.vote.findFirst({
      where: { userId, option: { votingId } },
    });
  }

  async createVotes(voteData: { userId: string; optionId: string }[], tx: any) {
    return tx.vote.createMany({ data: voteData });
  }

  async update(id: string, data: any) {
    return this.prisma.voting.update({
      where: { id },
      data,
      include: { options: true },
    });
  }

  async delete(id: string) {
    return this.prisma.voting.delete({ where: { id } });
  }
}
