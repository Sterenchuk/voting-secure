// backend/src/votings/dto/voting.response.dto.ts
import { VotingType } from '@prisma/client';
import { OptionResponseDto } from './option.response.dto';

export class VotingResponseDto {
  id: string;
  title: string;
  isOpen: boolean;
  description?: string | null;
  type: VotingType;
  isSurvey: boolean;
  createdAt: Date;
  startAt?: Date | null;
  endAt?: Date | null;
  groupId: string;
  options?: OptionResponseDto[];
  questions?: any[];
}
export const SELECT_VOTING_FIELDS = {
  id: true,
  title: true,
  isOpen: true,
  description: true,
  type: true,
  isSurvey: true,
  createdAt: true,
  startAt: true,
  endAt: true,
  groupId: true,
} as const;

export const SELECT_VOTING_WITH_OPTIONS = {
  ...SELECT_VOTING_FIELDS,
  options: {
    select: {
      id: true,
      addedBy: true,
      addedByUser: true,
      text: true,
      votingId: true,
    },
  },
  questions: {
    include: {
      options: true,
    },
  },
} as const;
