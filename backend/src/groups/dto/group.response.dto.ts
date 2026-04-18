import { Prisma } from '@prisma/client';

export class CreatorInfo {
  id: string;
  email: string;
  name: string | null; // FIX: was `string | undefined`, Prisma returns null
}

export class UserGroupResponseDto {
  id: string;
  userId: string;
  groupId: string;
  role: string;
  user?: {
    email: string;
    name: string | null; // FIX: was `string | undefined`
  };
}

export class GroupResponseDto {
  id: string;
  name: string;
  creatorId: string;
  creator?: CreatorInfo;
  deletedAt: Date | null; // FIX: was `Date | undefined`, Prisma returns null
  createdAt: Date;
  updatedAt: Date;
  memberCount?: number;
  users?: UserGroupResponseDto[];
}

export const SELECT_GROUP_FIELDS = {
  id: true,
  name: true,
  creatorId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
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
  updatedAt: true,
  deletedAt: true,
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
  creator: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
} as const;

export const SELECT_USER_GROUP_FIELDS = {
  id: true,
  userId: true,
  groupId: true,
  role: true,
} as const;

export const SELECT_GROUP_MEMBERS = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as Prisma.UserGroupInclude;
