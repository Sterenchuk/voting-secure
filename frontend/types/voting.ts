export enum VotingType {
  SINGLE_CHOICE = "SINGLE_CHOICE",
  MULTIPLE_CHOICE = "MULTIPLE_CHOICE",
}

export interface Voting {
  id: string;
  title: string;
  description?: string;
  groupId: string;
  type: VotingType;
  isPublic: boolean;
  isFinalized: boolean;
  allowOther: boolean;
  allowAbstain: boolean;
  minChoices: number;
  maxChoices?: number;
  startAt?: string;
  endAt?: string;
  createdAt: string;
}
