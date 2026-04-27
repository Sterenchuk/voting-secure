export const SELECT_OPTION = {
  id: true,
  text: true,
  votingId: true,
  isDynamic: true,
} as const;

export const SELECT_OPTION_WITH_VOTE_COUNT = {
  ...SELECT_OPTION,
  _count: { select: { ballots: true } },
} as const;
