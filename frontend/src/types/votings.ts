export const VOTING_TYPES = [
  "STANDARD",
  "FRIENDLY",
  "MULTIPLE_CHOICE",
  "SURVEY",
] as const;
export type VotingType = (typeof VOTING_TYPES)[number];

// Randomizer types
export const RANDOMIZER_TYPES = [
  "NONE",
  "COIN_FLIP", // Only 2 options
  "ROULETTE", // 3+ options
  "PLINKO", // Only 2 options
  "SPINNER", // Any number of options
  "DICE_ROLL", // 2-6 options
] as const;
export type RandomizerType = (typeof RANDOMIZER_TYPES)[number];

// Question option for surveys
export interface QuestionOption {
  optionId: string;
  text: string;
  responseCount: number;
  percentage: number;
}

export interface Question {
  questionId: string;
  text: string;
  allowMultiple: boolean;
  options: QuestionOption[];
}

export interface Option {
  id: string;
  text: string;
  voteCount: number;
}

export interface Voting {
  id: string;
  title: string;
  description?: string;
  groupId: string;
  groupName: string;
  startAt?: string;
  endAt?: string;
  voteCount: number;
  type: VotingType;
  options?: Option[];
  allowMultiple?: boolean;
  allowUserOptions?: boolean;
  randomizerType?: RandomizerType;
  questions?: Question[];
}
