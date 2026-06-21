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
import { CryptoUtils } from '../common/utils/crypto-utils';
import { Role } from '../common/enums/role';

@Injectable()
export class GroupsService {
  constructor(private readonly databaseService: DatabaseService) {}

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    if (local.length <= 2) return `${local}*******@${domain}`;
    return `${local.substring(0, 2)}*******@${domain}`;
  }

  private processMemberEmails(
    group: GroupResponseDto,
    userId?: string,
    platformRole?: Role,
  ): GroupResponseDto {
    if (!group) return group;

    const userMembership =
      userId && group.users
        ? group.users.find((u: any) => u.userId === userId)
        : null;

    const canSeeFullEmails =
      platformRole === Role.ADMIN ||
      userMembership?.role === GroupRole.OWNER ||
      userMembership?.role === GroupRole.ADMIN;

    // Process creator email
    if (group.creator && group.creator.email) {
      const decrypted = CryptoUtils.decrypt(group.creator.email);
      const isSelf = group.creatorId === userId;
      group.creator.email =
        canSeeFullEmails || isSelf ? decrypted : this.maskEmail(decrypted);
    }

    // Process member emails
    if (group.users) {
      group.users = group.users.map((m: any) => {
        if (!m.user || !m.user.email) return m;

        const decrypted = CryptoUtils.decrypt(m.user.email);
        const isSelf = m.userId === userId;

        m.user.email =
          canSeeFullEmails || isSelf ? decrypted : this.maskEmail(decrypted);

        return m;
      });
    }

    return group;
  }

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
      throw new NotFoundException('Group or resource not found');
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
      throw new NotFoundException('Group or resource not found');
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
    platformRole?: Role,
  ): Promise<GroupResponseDto> {
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

    return this.processMemberEmails(group as any, userId, platformRole);
  }

  async findAll(
    userId: string,
    role: Role,
    name?: string,
  ): Promise<GroupResponseDto[]> {
    const isAdminOrAuditor = role === Role.ADMIN || role === Role.AUDITOR;

    const groupsResult = await this.databaseService.group.findMany({
      where: {
        ...(name && { name: { contains: name, mode: 'insensitive' } }),
        ...(!isAdminOrAuditor && {
          users: { some: { userId } },
        }),
      },
      select: {
        ...SELECT_GROUP_FIELDS,
        users: {
          where: { userId },
          select: { role: true },
        },
      },
    });

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

  async findOne(
    id: string,
    userId?: string,
    platformRole?: Role,
  ): Promise<GroupResponseDto> {
    const group = await this.databaseService.group.findUnique({
      where: { id },
      select: SELECT_GROUP_WITH_USERS,
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const processedGroup = this.processMemberEmails(
      group as any,
      userId,
      platformRole,
    );
    const membership = userId
      ? processedGroup.users?.find((u: any) => u.userId === userId)
      : null;

    return {
      ...processedGroup,
      isMember: !!membership,
      userRole: membership?.role,
    } as any;
  }

  async findMembers(
    groupId: string,
    userId?: string,
    platformRole?: Role,
  ): Promise<any[]> {
    const members = await this.databaseService.userGroup.findMany({
      where: { groupId },
      include: SELECT_GROUP_MEMBERS,
    });

    const dummyGroup = { users: members } as any;
    const processed = this.processMemberEmails(
      dummyGroup,
      userId,
      platformRole,
    );
    return processed?.users ?? [];
  }

  async update(
    userId: string,
    id: string,
    groupUpdateDto: GroupUpdateDto,
    platformRole?: Role,
  ): Promise<GroupResponseDto> {
    await this.checkAdminPermission(userId, id);

    const updated = await this.databaseService.group.update({
      where: { id },
      data: groupUpdateDto,
      select: SELECT_GROUP_WITH_USERS,
    });

    const processed = this.processMemberEmails(
      updated as any,
      userId,
      platformRole,
    );
    const membership = processed?.users?.find((u: any) => u.userId === userId);

    return {
      ...processed,
      isMember: !!membership,
      userRole: membership?.role,
    } as any;
  }

  async addUsers(
    userId: string,
    groupId: string,
    userIds: string[],
    platformRole?: Role,
  ): Promise<GroupResponseDto> {
    if (!userIds.length) {
      throw new BadRequestException('At least one user is required');
    }

    await this.checkAdminPermission(userId, groupId);

    const updated = await this.databaseService.group.update({
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

    return this.processMemberEmails(updated as any, userId, platformRole);
  }

  async removeUsers(
    userId: string,
    groupId: string,
    userIds: string[],
    platformRole?: Role,
  ): Promise<GroupResponseDto> {
    if (!userIds.length) {
      throw new BadRequestException('At least one user is required');
    }

    await this.checkAdminPermission(userId, groupId);

    const updated = await this.databaseService.group.update({
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

    return this.processMemberEmails(updated as any, userId, platformRole);
  }

  async changeUserRole(
    adminId: string,
    groupId: string,
    changeRoleDto: ChangeRoleDto & { targetUserId?: string },
    platformRole?: Role,
  ): Promise<GroupResponseDto> {
    await this.checkAdminPermission(adminId, groupId);

    if (changeRoleDto.role === GroupRole.OWNER) {
      throw new BadRequestException('Cannot assign OWNER role to another user');
    }

    const targetUserId = changeRoleDto.targetUserId;

    if (!targetUserId) {
      throw new BadRequestException('Target user ID is required');
    }

    const groupCheck = await this.databaseService.group.findUnique({
      where: { id: groupId },
      select: { creatorId: true },
    });

    if (!groupCheck) {
      throw new NotFoundException('Group not found');
    }

    if (targetUserId === groupCheck.creatorId) {
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
    });

    const updatedGroup = await this.databaseService.group.findUnique({
      where: { id: groupId },
      select: SELECT_GROUP_WITH_USERS,
    });

    if (!updatedGroup) {
      throw new NotFoundException('Group not found');
    }

    return this.processMemberEmails(updatedGroup as any, adminId, platformRole);
  }

  async delete(userId: string, id: string) {
    await this.checkAdminPermission(userId, id, true);

    await this.databaseService.userGroup.deleteMany({
      where: { groupId: id },
    });

    await this.databaseService.group.delete({
      where: { id },
    });

    return { message: 'Group deleted successfully' };
  }
}
