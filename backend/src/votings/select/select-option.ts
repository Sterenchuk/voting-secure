export const SELECT_OPTION = {
  id: true,
  text: true,
  votingId: true,
} as const;

export const SELECT_OPTION_WITH_VOTE_COUNT = {
  ...SELECT_OPTION,
  _count: { select: { votes: true } },
} as const;
