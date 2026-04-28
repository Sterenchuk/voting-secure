import { DatabaseService, PrismaTx } from '../database/database.service';
import { GroupRole } from '../common/enums/group-role';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GroupCreateDto,
  GroupUpdateDto,
  ChangeRoleDto,
} from './dto/group.input.dto';
import {
  GroupResponseDto,
  SELECT_GROUP_FIELDS,
  SELECT_GROUP_WITH_USERS,
  SELECT_GROUP_MEMBERS,
} from './dto/group.response.dto';
import { handlePrismaError } from '../common/utils/prisma-error';

@Injectable()
export class GroupsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async checkAdminPermission(
    userId: string,
    groupId: string,
    requireOwner = false,
    tx?: PrismaTx,
  ): Promise<void> {
    const db = tx || this.databaseService;

    const membership = await db.userGroup.findUnique({
      where: {
        userId_groupId: { userId, groupId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    if (membership.role === GroupRole.OWNER) {
      return;
    }

    if (requireOwner) {
      throw new ForbiddenException(
        'Only the group owner can perform this action',
      );
    }

    const hasPermission =
      membership.role === GroupRole.ADMIN ||
      membership.role === GroupRole.MODERATOR;

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }
  }

  async checkMembership(
    userId: string,
    groupId: string,
    tx?: PrismaTx,
  ): Promise<void> {
    const db = tx || this.databaseService;
    const membership = await db.userGroup.findUnique({
      where: {
        userId_groupId: { userId, groupId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }
  }

  private async getUserIdsByEmails(emails: string[]): Promise<string[]> {
    const users = await this.databaseService.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });

    if (users.length !== emails.length) {
      const foundEmails = users.map((u) => u.email);
      const missingEmails = emails.filter((e) => !foundEmails.includes(e));
      throw new NotFoundException(
        `Users not found: ${missingEmails.join(', ')}`,
      );
    }

    return users.map((u) => u.id);
  }

  async create(
    userId: string,
    groupCreateDto: GroupCreateDto,
  ): Promise<GroupResponseDto> {
    const userIds = await this.getUserIdsByEmails(groupCreateDto.userEmails);

    const allUserIds = userIds.includes(userId)
      ? userIds
      : [userId, ...userIds];

    return this.databaseService.group.create({
      data: {
        name: groupCreateDto.name,
        creatorId: userId,
        users: {
          create: allUserIds.map((id) => ({
            userId: id,
            role: id === userId ? GroupRole.OWNER : GroupRole.MEMBER,
          })),
        },
        votings: {
          connect:
            groupCreateDto.votingIds?.map((votingId) => ({
              id: votingId,
            })) || [],
        },
      },
      select: SELECT_GROUP_WITH_USERS,
    }).catch(e => handlePrismaError(e, 'Creating group'));
  }

  async findAll(userId: string, name?: string): Promise<GroupResponseDto[]> {
    const groupsResult = await this.databaseService.group.findMany({
      where: {
        ...(name && { name: { contains: name, mode: 'insensitive' } }),
      },
      select: {
        ...SELECT_GROUP_FIELDS,
        users: {
          where: { userId },
          select: { role: true },
        },
      },
    }).catch(e => handlePrismaError(e, 'Finding all groups'));

    return groupsResult.map((group) => ({
      id: group.id,
      name: group.name,
      creatorId: group.creatorId,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      deletedAt: group.deletedAt,
      memberCount: group._count.users,
      isMember: group.users.length > 0,
      userRole: group.users[0]?.role,
    })) as any;
  }

  async findOne(id: string, userId?: string): Promise<GroupResponseDto> {
    const group = await this.databaseService.group.findUnique({
      where: { id },
      select: {
        ...SELECT_GROUP_WITH_USERS,
        users: {
          select: {
            id: true,
            userId: true,
            groupId: true,
            role: true,
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    }).catch(e => handlePrismaError(e, 'Finding group'));

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const membership = userId 
      ? group.users.find(u => u.userId === userId)
      : null;

    return {
      ...group,
      isMember: !!membership,
      userRole: membership?.role,
    } as any;
  }

  async findMembers(groupId: string): Promise<any[]> {
    return this.databaseService.userGroup.findMany({
      where: { groupId },
      include: SELECT_GROUP_MEMBERS,
    }).catch(e => handlePrismaError(e, 'Finding group members'));
  }

  async update(
    userId: string,
    id: string,
    groupUpdateDto: GroupUpdateDto,
  ): Promise<GroupResponseDto> {
    await this.checkAdminPermission(userId, id);

    return this.databaseService.group.update({
      where: { id },
      data: groupUpdateDto,
      select: SELECT_GROUP_FIELDS,
    }).catch(e => handlePrismaError(e, 'Updating group'));
  }

  async addUsers(
    userId: string,
    groupId: string,
    userIds: string[],
  ): Promise<GroupResponseDto> {
    if (!userIds.length) {
      throw new BadRequestException('At least one user is required');
    }

    await this.checkAdminPermission(userId, groupId);

    return this.databaseService.group.update({
      where: { id: groupId },
      data: {
        users: {
          createMany: {
            data: userIds.map((id) => ({
              userId: id,
              role: GroupRole.MEMBER,
            })),
            skipDuplicates: true,
          },
        },
      },
      select: SELECT_GROUP_WITH_USERS,
    }).catch(e => handlePrismaError(e, 'Adding users to group'));
  }

  async removeUsers(
    userId: string,
    groupId: string,
    userIds: string[],
  ): Promise<GroupResponseDto> {
    if (!userIds.length) {
      throw new BadRequestException('At least one user is required');
    }

    await this.checkAdminPermission(userId, groupId);

    return this.databaseService.group.update({
      where: { id: groupId },
      data: {
        users: {
          deleteMany: {
            userId: { in: userIds },
          },
        },
      },
      select: SELECT_GROUP_WITH_USERS,
    }).catch(e => handlePrismaError(e, 'Removing users from group'));
  }

  async changeUserRole(
    adminId: string,
    groupId: string,
    changeRoleDto: ChangeRoleDto & { targetUserId?: string },
  ): Promise<GroupResponseDto> {
    await this.checkAdminPermission(adminId, groupId);

    if (changeRoleDto.role === GroupRole.OWNER) {
      throw new BadRequestException(
        'Cannot assign OWNER role to another user',
      );
    }

    const targetUserId = changeRoleDto.targetUserId;

    if (!targetUserId) {
      throw new BadRequestException('Target user ID is required');
    }

    const group = await this.databaseService.group.findUnique({
      where: { id: groupId },
      select: { creatorId: true },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (targetUserId === group.creatorId) {
      throw new BadRequestException('Cannot change role of the group owner');
    }

    await this.databaseService.userGroup.update({
      where: {
        userId_groupId: {
          userId: targetUserId,
          groupId,
        },
      },
      data: {
        role: changeRoleDto.role,
      },
    }).catch(e => handlePrismaError(e, 'Changing user role in group'));

    const updatedGroup = await this.databaseService.group.findUnique({
      where: { id: groupId },
      select: SELECT_GROUP_WITH_USERS,
    });

    if (!updatedGroup) {
      throw new NotFoundException('Group not found');
    }

    return updatedGroup;
  }

  async delete(userId: string, id: string) {
    await this.checkAdminPermission(userId, id, true);

    await this.databaseService.userGroup.deleteMany({
      where: { groupId: id },
    }).catch(e => handlePrismaError(e, 'Deleting group members'));

    await this.databaseService.group.delete({
      where: { id },
    }).catch(e => handlePrismaError(e, 'Deleting group'));

    return { message: 'Group deleted successfully' };
  }
}
