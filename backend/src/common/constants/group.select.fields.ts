export const GROUP_SELECT_FIELDS = {
  id: true,
  name: true,
  creatorId: true,
  createdAt: true,
  users: true,
  votings: {
    include: {
      options: true,
    },
  },
} as const;
