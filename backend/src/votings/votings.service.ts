import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { VotingsRepository } from './votings.repository';
import { handlePrismaError } from '../common/utils/prisma-error';
import {
  VotingType,
  ICreateVotingData,
  IUpdateVotingData,
  IVotingWhereInput,
} from './types/voting.types';
import { AuditAction } from '../common/enums/audit.actions';
import type { VotingCreateDto } from './dto/voting.create.dto';
import type { VotingUpdateDto } from './dto/voting.update.dto';
import type { FindVotingQueryDto } from './dto/find.voting.query.dto';
import { GroupsService } from '../groups/groups.service';

@Injectable()
export class VotingsService {
  constructor(
    private readonly repo: VotingsRepository,
    private readonly groupService: GroupsService,
  ) {}

  // ─── Voting CRUD ─────────────────────────────────────────────────────────────

  async create(userId: string, dto: VotingCreateDto) {
    await this.groupService.checkAdminPermission(userId, dto.groupId);
    if (!dto.options || dto.options.length < 2) {
      throw new BadRequestException('Voting must have at least 2 options');
    }
    if (
      dto.type === VotingType.MULTIPLE_CHOICE &&
      dto.minChoices &&
      dto.maxChoices &&
      dto.minChoices > dto.maxChoices
    ) {
      throw new BadRequestException('minChoices cannot exceed maxChoices');
    }

    const data: ICreateVotingData = {
      title: dto.title,
      description: dto.description,
      groupId: dto.groupId,
      type: (dto.type as VotingType) ?? VotingType.SINGLE_CHOICE,
      isOpen: dto.isOpen ?? false,
      allowOther: dto.allowOther ?? false,
      minChoices: dto.minChoices ?? 1,
      maxChoices: dto.maxChoices,
      startAt: dto.startAt ? new Date(dto.startAt) : undefined,
      endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      options: dto.options,
    };

    return this.repo.createVoting(userId, data).catch((e) => handlePrismaError(e, 'Creating voting'));
  }

  async findAll(dto: FindVotingQueryDto) {
    const where: IVotingWhereInput = { deletedAt: null };
    if (dto.groupId) where.groupId = dto.groupId;
    if (dto.title) where.title = { contains: dto.title, mode: 'insensitive' };
    if (dto.startAt) where.startAt = { gte: new Date(dto.startAt) };
    if (dto.endAt) where.endAt = { lte: new Date(dto.endAt) };
    if (dto.isOpen !== undefined) where.isOpen = dto.isOpen;

    return this.repo.findVotings(where).catch((e) => handlePrismaError(e, 'Finding votings'));
  }

  async findOne(id: string) {
    const voting = await this.repo.findVotingById(id).catch((e) => handlePrismaError(e, 'Finding voting'));
    if (!voting || (voting as any).deletedAt)
      throw new NotFoundException('Voting not found');

    return {
      ...voting,
      options: voting.options.map(({ _count, ...opt }) => ({
        ...opt,
        voteCount: _count.ballots,
      })),
    };
  }

  async update(id: string, dto: VotingUpdateDto, userId: string) {
    const voting = await this.repo.findVotingRaw(id).catch((e) => handlePrismaError(e, 'Updating voting'));
    if (!voting) throw new NotFoundException('Voting not found');

    await this.groupService.checkAdminPermission(userId, voting.groupId);

    if (voting.isFinalized)
      throw new ForbiddenException('Cannot update a finalized voting');

    if (
      (dto.type === VotingType.MULTIPLE_CHOICE ||
        (!dto.type && voting.type === VotingType.MULTIPLE_CHOICE)) &&
      dto.minChoices &&
      dto.maxChoices &&
      dto.minChoices > dto.maxChoices
    ) {
      throw new BadRequestException('minChoices cannot exceed maxChoices');
    }

    const data: IUpdateVotingData = {
      title: dto.title,
      description: dto.description,
      isOpen: dto.isOpen,
      allowOther: dto.allowOther,
      minChoices: dto.minChoices,
      maxChoices: dto.maxChoices,
      startAt: dto.startAt ? new Date(dto.startAt) : undefined,
      endAt: dto.endAt ? new Date(dto.endAt) : undefined,
    };

    return this.repo.updateVoting(id, data).catch((e) => handlePrismaError(e, 'Updating voting'));
  }

  async updateOption(
    votingId: string,
    optionId: string,
    text: string,
    userId: string,
  ) {
    const voting = await this.repo.findVotingRaw(votingId).catch((e) => handlePrismaError(e, 'Updating option'));
    if (!voting) throw new NotFoundException('Voting not found');

    await this.groupService.checkAdminPermission(userId, voting.groupId);

    // Integrity Check: Block updates if voting is finalized or ballots exist
    if (voting.isFinalized) {
      throw new ForbiddenException(
        'Cannot update options of a finalized voting',
      );
    }

    const ballotCount = await this.repo.countBallotsByVoting(votingId);
    if (ballotCount > 0) {
      throw new ForbiddenException(
        'Cannot update options after ballots have been cast',
      );
    }

    const updatedOption = await this.repo.updateOption(optionId, text).catch((e) => handlePrismaError(e, 'Updating option'));

    // Audit the change (Rec(2004)11 §52)
    await this.repo.createAuditLog({
      action: AuditAction.OPTION_UPDATED,
      userId,
      votingId,
      payload: { optionId, newText: text },
    });

    return updatedOption;
  }

  async delete(id: string, userId: string) {
    const voting = await this.repo.findVotingRaw(id).catch((e) => handlePrismaError(e, 'Deleting voting'));
    if (!voting) throw new NotFoundException('Voting not found');

    await this.groupService.checkAdminPermission(userId, voting.groupId);

    if (voting.isFinalized)
      throw new ForbiddenException('Cannot delete a finalized voting');

    return this.repo.softDeleteVoting(id).catch((e) => handlePrismaError(e, 'Deleting voting'));
  }
}
