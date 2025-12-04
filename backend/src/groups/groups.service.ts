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

import { handlePrismaError } from 'src/common/utils/prisma-error';
import { ChangeRoleDto } from './dto/change.role.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Checks if user has OWNER rights in the group
   */
  private async checkCreatorPermission(
    userId: string,
    groupId: string,
  ): Promise<void> {
    const membership = await this.databaseService.userGroup.findUnique({
      where: {
        userId_groupId: { userId, groupId },
      },
    });

    if (!membership || membership.role !== GroupRole.OWNER) {
      throw new ForbiddenException(
        'Only the group owner can perform this action',
      );
    }
  }

  /**
   * Create a new group with the creator as OWNER
   */
  async create(userId: string, groupCreateDto: GroupCreateDto): Promise<Group> {
    try {
      // Ensure creator is included
      const allUserIds = groupCreateDto.userIds.includes(userId)
        ? groupCreateDto.userIds
        : [userId, ...groupCreateDto.userIds];

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
        include: {
          users: { include: { user: true } },
        },
      });

      return group;
    } catch (error) {
      handlePrismaError(error, 'create group');
    }
  }

  async findAll(id: string, name?: string): Promise<Group[]> {
    try {
      if (!name) {
        return await this.databaseService.group.findMany({
          where: { name, users: { some: { userId: id } } },
        });
      } else {
        return await this.databaseService.group.findMany();
      }
    } catch (error) {
      handlePrismaError(error, 'find all groups');
    }
  }

  async findOne(id: string): Promise<Group> {
    try {
      const group = await this.databaseService.group.findUnique({
        where: { id },
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }

      return group;
    } catch (error) {
      handlePrismaError(error, 'find one group');
    }
  }

  async update(
    userId: string,
    id: string,
    groupUpdateDto: GroupUpdateDto,
  ): Promise<Group> {
    try {
      await this.checkCreatorPermission(userId, id);

      return this.databaseService.group.update({
        where: { id },
        data: groupUpdateDto,
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
    userIds: string[],
  ): Promise<Group> {
    if (!userIds.length) {
      throw new BadRequestException('At least one user ID is required');
    }

    try {
      await this.checkCreatorPermission(userId, groupId);

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
      });
    } catch (error) {
      handlePrismaError(error, 'add users to group');
    }
  }

  async removeUsers(
    userId: string,
    groupId: string,
    userIds: string[],
  ): Promise<Group> {
    if (!userIds.length) {
      throw new BadRequestException('At least one user ID is required');
    }

    try {
      await this.checkCreatorPermission(userId, groupId);

      return await this.databaseService.group.update({
        where: { id: groupId },
        data: {
          users: {
            deleteMany: userIds.map((id) => ({
              userId: id,
            })),
          },
        },
      });
    } catch (error) {
      handlePrismaError(error, 'remove users from group');
    }
  }

  async changeUserRole(
    adminId: string,
    groupId: string,
    changeRoleDto: ChangeRoleDto,
  ): Promise<UserGroup> {
    try {
      await this.checkCreatorPermission(adminId, groupId);

      const updatedUserGroup = await this.databaseService.userGroup.update({
        where: {
          userId_groupId: {
            userId: changeRoleDto.userId,
            groupId,
          },
        },
        data: {
          role: changeRoleDto.role, // or GroupRole.ADMIN if you import enum
        },
        include: {
          user: true,
          group: true,
        },
      });

      return updatedUserGroup;
    } catch (e) {
      handlePrismaError(e, 'promote group member to admin');
    }
  }

  /**
   * Delete a group (owner only)
   */
  async delete(userId: string, id: string) {
    try {
      await this.checkCreatorPermission(userId, id);

      // must delete memberships first due to FK constraints
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
