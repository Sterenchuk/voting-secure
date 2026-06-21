export const SELECT_QUESTION_OPTIONS = {
  id: true,
  text: true,
  order: true,
  isDynamic: true,
} as const;

export const SELECT_CHOICE_CONFIG = {
  id: true,
  allowOther: true,
  allowMultiple: true,
  minChoices: true,
  maxChoices: true,
} as const;

export const SELECT_SCALE_CONFIG = {
  id: true,
  scaleMin: true,
  scaleMax: true,
  step: true,
} as const;

export const SELECT_SURVEY_QUESTIONS = {
  id: true,
  type: true,
  text: true,
  isRequired: true,
  order: true,
  choiceConfig: {
    select: SELECT_CHOICE_CONFIG,
  },
  scaleConfig: {
    select: SELECT_SCALE_CONFIG,
  },
  options: {
    select: SELECT_QUESTION_OPTIONS,
  },
} as const;

export const SELECT_SURVEY = {
  id: true,
  creatorId: true,
  groupId: true,
  title: true,
  description: true,
  isPublic: true,
  isFinalized: true,
  allowAbstain: true,
  createdAt: true,
  updatedAt: true,
  startAt: true,
  endAt: true,
  deletedAt: true,
  finalizedAt: true,
  _count: {
    select: {
      participations: true,
    },
  },
} as const;

export const SELECT_SURVEY_WITH_QUESTIONS = {
  ...SELECT_SURVEY,
  questions: {
    select: SELECT_SURVEY_QUESTIONS,
  },
} as const;

export const SELECT_SURVEY_BALLOT = {
  id: true,
  questionId: true,
  optionId: true,
  ballotHash: true,
} as const;

export const SELECT_SURVEY_FOR_SUBMISSION = {
  id: true,
  title: true,
  description: true,
  isPublic: true,
  isFinalized: true,
  startAt: true,
  endAt: true,

  questions: {
    select: {
      id: true,
      text: true,
      isRequired: true,
      type: true,
      choiceConfig: {
        select: SELECT_CHOICE_CONFIG,
      },
      scaleConfig: {
        select: SELECT_SCALE_CONFIG,
      },
      options: {
        select: {
          id: true,
          text: true,
          isDynamic: true,
        },
      },
    },
  },
} as const;
