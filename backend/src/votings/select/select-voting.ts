import { SELECT_OPTION } from './select-option';

export const SELECT_VOTING = {
  id: true,
  title: true,
  description: true,
  groupId: true,
  type: true,
  isOpen: true,
  allowOther: true,
  minChoices: true,
  maxChoices: true,
  startAt: true,
  endAt: true,
  createdAt: true,
} as const;

export const SELECT_VOTING_WITH_OPTIONS = {
  ...SELECT_VOTING,
  options: { select: SELECT_OPTION },
} as const;

export const SELECT_VOTING_FOR_VOTE = {
  id: true,
  isOpen: true,
  groupId: true,
  type: true,
  allowOther: true,
  minChoices: true,
  maxChoices: true,
  startAt: true,
  endAt: true,
  options: { select: { id: true } },
} as const;
