import { Prisma } from '@prisma/client';

export const SELECT_GROUP_MEMBERS = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as Prisma.UserGroupSelect; // or Prisma.UserGroupInclude
