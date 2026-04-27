// ─── Enums ────────────────────────────────────────────────────────────────────

export enum VotingType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
}

// ─── Voting ───────────────────────────────────────────────────────────────────

export interface IVoting {
  id: string;
  creatorId: string;
  groupId: string;
  title: string;
  description: string | null;
  type: VotingType;
  isOpen: boolean;
  isFinalized: boolean;
  allowOther: boolean;
  minChoices: number;
  maxChoices: number | null;
  startAt: Date | null;
  endAt: Date | null;
  finalizedAt: Date | null;
  createdAt: Date;
}

export interface IVotingWithOptions extends IVoting {
  options: IOption[];
}

export interface IVotingDetail extends IVoting {
  options: IOptionWithVoteCount[];
}

export interface ICreateVotingData {
  groupId: string;
  title: string;
  description?: string;
  type: VotingType;
  isOpen: boolean;
  allowOther: boolean;
  minChoices: number;
  maxChoices?: number;
  startAt?: Date;
  endAt?: Date;
  options: string[];
}

export interface IUpdateVotingData {
  title?: string;
  description?: string;
  isFinalized?: boolean;
  finalizedAt?: Date;
  isOpen?: boolean;
  allowOther?: boolean;
  minChoices?: number;
  maxChoices?: number;
  startAt?: Date;
  endAt?: Date;
}

export interface IVotingWhereInput {
  groupId?: string;
  title?: { contains: string; mode: 'insensitive' };
  startAt?: { gte: Date };
  endAt?: { lte: Date };
  isOpen?: boolean;
  isFinalized?: boolean;
  deletedAt?: null;
}

// ─── Option ───────────────────────────────────────────────────────────────────

export interface IOption {
  id: string;
  text: string;
  votingId: string;
}

export interface IOptionWithVoteCount extends IOption {
  voteCount: number;
}

// ─── Ballot ───────────────────────────────────────────────────────────────────

// Rec(2004)11 §26 — ballot carries no userId, only a client-generated hash
export interface IBallot {
  id: string;
  votingId: string;
  optionId: string;
  ballotHash: string;
}

export interface IBallotInput {
  optionId: string;
}

// ─── Participation ────────────────────────────────────────────────────────────

export interface IVoteParticipation {
  id: string;
  userId: string;
  votingId: string;
  createdAt: Date;
}

// ─── Results ──────────────────────────────────────────────────────────────────

export interface IOptionResult {
  id: string;
  text: string;
  isDynamic: boolean;
  voteCount: number;
}

export interface IVotingResults {
  options: IOptionResult[];
  totalBallots: number;
  dynamicOptions?: IOptionResult[];
}

// ─── Sealed result ────────────────────────────────────────────────────────────

export interface IVotingResult {
  id: string;
  votingId: string;
  tally: Record<string, number>;
  totalBallots: number;
  tallyHash: string;
  sealedAt: Date;
}

// ─── User vote status ─────────────────────────────────────────────────────────

// Rec(2004)11: only participation status is returned, never the choice made
export interface IUserVoteStatus {
  participated: boolean;
}

// ─── WebSocket events ─────────────────────────────────────────────────────────

export interface IVotingResultsEvent {
  votingId: string;
  results: IVotingResults;
}
