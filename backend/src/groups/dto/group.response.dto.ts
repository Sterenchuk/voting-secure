import { UserGroupResponseDto } from './user-group.response.dto';

export class GroupResponseDto {
  id: string;
  name: string;
  creatorId: string;
  createdAt: Date;
  memberCount?: number;
  users?: UserGroupResponseDto[];
}

export const SELECT_GROUP_FIELDS = {
  id: true,
  name: true,
  creatorId: true,
  createdAt: true,

  _count: {
    select: {
      users: true,
    },
  },
} as const;

export const SELECT_GROUP_WITH_USERS = {
  id: true,
  name: true,
  creatorId: true,
  createdAt: true,

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
} as const;
