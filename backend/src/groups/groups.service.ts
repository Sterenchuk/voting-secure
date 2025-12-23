import { DatabaseService } from 'src/database/database.service';
import { Group, UserGroup } from '@prisma/client';
import { GroupRole } from 'src/common/enums/group-role';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupCreateDto } from './dto/group.create.dto';
import { GroupUpdateDto } from './dto/group.update.dto';
import {
  GroupResponseDto,
  SELECT_GROUP_FIELDS,
  SELECT_GROUP_WITH_USERS,
} from './dto/group.response.dto';
import { handlePrismaError } from 'src/common/utils/prisma-error';
import { ChangeRoleDto } from './dto/change.role.dto';
import { SELECT_GROUP_MEMBERS } from './dto/find-members.dtp';

@Injectable()
export class GroupsService {
  constructor(private readonly databaseService: DatabaseService) {}

  private async checkCreatorPermission(
    userId: string,
    groupId: string,
  ): Promise<void> {
    const membership = await this.databaseService.userGroup.findUnique({
      where: {
        userId_groupId: { userId, groupId },
      },
    });

    if (
      !membership ||
      (membership.role !== GroupRole.OWNER &&
        membership.role !== GroupRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'Only the group admins can perform this action',
      );
    }
  }

  /**
   * Helper method to find user IDs by emails
   */
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

  /**
   * Create a new group with the creator as OWNER
   */
  async create(
    userId: string,
    groupCreateDto: GroupCreateDto,
  ): Promise<GroupResponseDto> {
    try {
      const userIds = await this.getUserIdsByEmails(groupCreateDto.userEmails);

      const allUserIds = userIds.includes(userId)
        ? userIds
        : [userId, ...userIds];

      const group = await this.databaseService.group.create({
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
      });

      return group;
    } catch (error) {
      handlePrismaError(error, 'create group');
    }
  }

  async findAll(userId: string, name?: string): Promise<GroupResponseDto[]> {
    try {
      const groupsResult = await this.databaseService.group.findMany({
        where: {
          users: {
            some: {
              userId,
            },
          },
        },
        select: SELECT_GROUP_FIELDS,
      });

      const groupDtos: GroupResponseDto[] = groupsResult.map((group) => {
        return {
          id: group.id,
          name: group.name,
          creatorId: group.creatorId,
          createdAt: group.createdAt,

          memberCount: group._count.users,
        } as GroupResponseDto;
      });

      return groupDtos;
    } catch (error) {
      handlePrismaError(error, 'find all groups');
      throw error;
    }
  }
  async findOne(id: string): Promise<GroupResponseDto> {
    try {
      const group = await this.databaseService.group.findUnique({
        where: { id },
        select: SELECT_GROUP_WITH_USERS,
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }

      return group;
    } catch (error) {
      handlePrismaError(error, 'find one group');
    }
  }

  async findMembers(groupId: string): Promise<any[]> {
    try {
      const members = await this.databaseService.userGroup.findMany({
        where: { groupId },
        include: SELECT_GROUP_MEMBERS,
      });

      return members;
    } catch (error) {
      handlePrismaError(error, 'find group members');
    }
  }
  async update(
    userId: string,
    id: string,
    groupUpdateDto: GroupUpdateDto,
  ): Promise<GroupResponseDto> {
    try {
      await this.checkCreatorPermission(userId, id);

      return this.databaseService.group.update({
        where: { id },
        data: groupUpdateDto,
        select: SELECT_GROUP_FIELDS,
      });
    } catch (error) {
      handlePrismaError(error, 'update group');
    }
  }

  /**
   * Add members to group
   */
  async addUsers(
    userId: string,
    groupId: string,
    userEmails: string[],
  ): Promise<GroupResponseDto> {
    if (!userEmails.length) {
      throw new BadRequestException('At least one user email is required');
    }

    try {
      await this.checkCreatorPermission(userId, groupId);

      const userIds = await this.getUserIdsByEmails(userEmails);

      return await this.databaseService.group.update({
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
      });
    } catch (error) {
      handlePrismaError(error, 'add users to group');
    }
  }

  async removeUsers(
    userId: string,
    groupId: string,
    userEmails: string[],
  ): Promise<GroupResponseDto> {
    if (!userEmails.length) {
      throw new BadRequestException('At least one user email is required');
    }

    try {
      await this.checkCreatorPermission(userId, groupId);

      const userIds = await this.getUserIdsByEmails(userEmails);

      return await this.databaseService.group.update({
        where: { id: groupId },
        data: {
          users: {
            deleteMany: {
              userId: { in: userIds },
            },
          },
        },
        select: SELECT_GROUP_WITH_USERS,
      });
    } catch (error) {
      handlePrismaError(error, 'remove users from group');
    }
  }

  async changeUserRole(
    adminId: string,
    groupId: string,
    changeRoleDto: ChangeRoleDto,
  ): Promise<GroupResponseDto> {
    try {
      await this.checkCreatorPermission(adminId, groupId);

      if (changeRoleDto.role === GroupRole.OWNER) {
        throw new BadRequestException(
          'Cannot assign OWNER role to another user',
        );
      }

      const targetUser = await this.databaseService.user.findUnique({
        where: { email: changeRoleDto.userEmail },
        select: { id: true },
      });

      if (!targetUser) {
        throw new NotFoundException(
          `User with email ${changeRoleDto.userEmail} not found`,
        );
      }

      const _group = await this.databaseService.group.findUnique({
        where: { id: groupId },
        select: SELECT_GROUP_WITH_USERS,
      });

      if (!_group) {
        throw new NotFoundException('Group not found');
      }

      if (targetUser.id === _group.creatorId) {
        throw new BadRequestException('Cannot change role of the group owner');
      }

      await this.databaseService.userGroup.update({
        where: {
          userId_groupId: {
            userId: targetUser.id,
            groupId,
          },
        },
        data: {
          role: changeRoleDto.role,
        },
      });

      const group = await this.databaseService.group.findUnique({
        where: { id: groupId },
        select: SELECT_GROUP_WITH_USERS,
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }

      return group;
    } catch (e) {
      handlePrismaError(e, 'change user role in group');
    }
  }

  /**
   * Delete a group (owner only)
   */
  async delete(userId: string, id: string) {
    try {
      await this.checkCreatorPermission(userId, id);

      await this.databaseService.userGroup.deleteMany({
        where: { groupId: id },
      });

      await this.databaseService.group.delete({
        where: { id },
      });

      return { message: 'Group deleted successfully' };
    } catch (e) {
      handlePrismaError(e, 'delete group');
    }
  }
}
