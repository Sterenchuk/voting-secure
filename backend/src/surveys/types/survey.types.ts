export enum SurveyQuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  SCALE = 'SCALE',
  FREEFORM = 'FREEFORM',
}

export interface SurveyChoiceConfig {
  allowOther: boolean;
  allowMultiple: boolean;
  minChoices?: number;
  maxChoices?: number;
}

export interface SurveyScaleConfig {
  scaleMin: number;
  scaleMax: number;
  step: number;
}

export interface Survey {
  id: string;
  title: string;
  description?: string;
  creatorId: string;
  groupId: string;

  isOpen: boolean;
  isFinalized: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  endAt?: Date;
  finalizedAt?: Date;

  questions: SurveyQuestion[];
}

export interface ICreateSurveyData {
  title: string;
  description?: string;
  groupId: string;

  isOpen?: boolean;
  isFinalized?: boolean;
  endAt?: Date;

  surveyQuestions: ICreateSurveyQuestionData[];
}

export interface SurveyQuestion {
  id: string;
  surveyId: string;
  type: SurveyQuestionType;
  text: string;
  isRequired: boolean;
  order: number;
  
  choiceConfig?: SurveyChoiceConfig;
  scaleConfig?: SurveyScaleConfig;
  options: SurveyOption[];
}

export interface ICreateSurveyQuestionData {
  text: string;
  type: SurveyQuestionType;
  isRequired?: boolean;
  order?: number;

  choiceConfig?: Partial<SurveyChoiceConfig>;
  scaleConfig?: Partial<SurveyScaleConfig>;
  options: ICreateSurveyOptionData[];
}

export interface SurveyOption {
  id: string;
  questionId: string;
  text: string;
  order: number;
}

export interface ICreateSurveyOptionData {
  text: string;
  order?: number;
}

export interface SurveyBallot {
  id: string;
  questionId: string;
  optionId: string;
  ballotHash: string;
  tokenId?: string;
}

export interface SurveyFreeformBallot {
  id: string;
  questionId: string;
  text: string;
  ballotHash: string;
  tokenId?: string;
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
