// ─── Enums ────────────────────────────────────────────────────────────────────

export enum SurveyQuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  SCALE = 'SCALE',
  FREEFORM = 'FREEFORM',
}

// ─── Configs ──────────────────────────────────────────────────────────────────

export interface ISurveyChoiceConfig {
  allowOther: boolean;
  allowMultiple: boolean;
  minChoices?: number;
  maxChoices?: number;
}

export interface ISurveyScaleConfig {
  scaleMin: number;
  scaleMax: number;
  step: number;
}

// ─── Survey ───────────────────────────────────────────────────────────────────

export interface ISurvey {
  id: string;
  title: string;
  description: string | null;
  creatorId: string;
  groupId: string;
  isOpen: boolean;
  isFinalized: boolean;
  allowAbstain: boolean;
  startAt: Date | null;
  endAt: Date | null;
  finalizedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ISurveyWithQuestions extends ISurvey {
  questions: ISurveyQuestion[];
}

export interface ICreateSurveyData {
  title: string;
  description?: string;
  groupId: string;
  isOpen?: boolean;
  isFinalized?: boolean;
  allowAbstain?: boolean;
  startAt?: Date;
  endAt?: Date;
  surveyQuestions: ICreateSurveyQuestionData[];
}

export interface IUpdateSurveyData {
  title?: string;
  description?: string;
  isOpen?: boolean;
  isFinalized?: boolean;
  allowAbstain?: boolean;
  startAt?: Date;
  endAt?: Date;
  finalizedAt?: Date;
}

export interface ISurveyWhereInput {
  id?: string;
  creatorId?: string;
  groupId?: string;
  isOpen?: boolean;
  isFinalized?: boolean;
  deletedAt?: null | Date | { not: null };
  title?: string | { contains: string; mode?: 'insensitive' | 'default' };
  createdAt?: Date | { gte?: Date; lte?: Date };
  endAt?: Date | { gte?: Date; lte?: Date };
}

// ─── Question & Option ────────────────────────────────────────────────────────

export interface ISurveyQuestion {
  id: string;
  surveyId: string;
  type: SurveyQuestionType;
  text: string;
  isRequired: boolean;
  order: number;
  choiceConfig?: ISurveyChoiceConfig;
  scaleConfig?: ISurveyScaleConfig;
  options: ISurveyOption[];
}

export interface ICreateSurveyQuestionData {
  text: string;
  type: SurveyQuestionType;
  isRequired?: boolean;
  order?: number;
  choiceConfig?: Partial<ISurveyChoiceConfig>;
  scaleConfig?: Partial<ISurveyScaleConfig>;
  options: ICreateSurveyOptionData[];
}

export interface ISurveyOption {
  id: string;
  questionId: string;
  text: string;
  order: number;
  isDynamic: boolean;
}

export interface ICreateSurveyOptionData {
  text: string;
  order?: number;
}

// ─── Ballot ───────────────────────────────────────────────────────────────────

export interface ISurveyBallot {
  id: string;
  questionId: string;
  optionId: string | null;
  isAbstention: boolean;
  ballotHash: string;
  tokenId?: string;
}

export interface ISurveyFreeformBallot {
  id: string;
  questionId: string;
  text: string;
  ballotHash: string;
  tokenId?: string;
}

export interface ISurveyBallotInput {
  questionId: string;
  optionId?: string;
  text?: string;
  isAbstention?: boolean;
}

// ─── Participation ────────────────────────────────────────────────────────────

export interface ISurveyParticipation {
  id: string;
  userId: string;
  surveyId: string;
  createdAt: Date;
}

// ─── Results ──────────────────────────────────────────────────────────────────

export interface IQuestionResult {
  questionId: string;
  options: {
    id: string;
    text: string;
    count: number;
  }[];
  otherCount?: number;
  freeformAnswers?: string[];
}

export interface ISurveyResults {
  surveyId: string;
  totalResponses: number;
  results: IQuestionResult[];
}

export interface ISurveyResult {
  id: string;
  surveyId: string;
  tally: Record<string, any>;
  totalResponses: number;
  tallyHash: string;
  sealedAt: Date;
}

// ─── User survey status ───────────────────────────────────────────────────────

export interface IUserSurveyStatus {
  submitted: boolean;
  receipts?: string[];
}
