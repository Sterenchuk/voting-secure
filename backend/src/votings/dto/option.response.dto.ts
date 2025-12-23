export class OptionResponseDto {
  id: string;
  text: string;
  votingId: string;
}

export class OptionWithVotesResponseDto extends OptionResponseDto {
  voteCount: number;
}

export const SELECT_OPTION_FIELDS = {
  id: true,
  text: true,
  addedBy: true,
  votingId: true,
} as const;

export const SELECT_OPTION_WITH_VOTES = {
  id: true,
  text: true,
  votingId: true,
  addedBy: true,
  addedByUser: true,
  _count: {
    select: {
      votes: true,
    },
  },
} as const;
