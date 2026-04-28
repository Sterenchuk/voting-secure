// src/audit/types/audit.types.ts

// ─── Action Enums ─────────────────────────────────────────────────────────────

/**
 * OPERATIONAL actions → audit_chain collection (hash chain, permanent).
 * These are the actions that require tamper-evident proof.
 */
export enum ChainAction {
  // ── Voting lifecycle ──────────────────────────────────────────────────────
  VOTING_CREATED = 'VOTING_CREATED',
  VOTING_OPENED = 'VOTING_OPENED',
  VOTING_CLOSED = 'VOTING_CLOSED',
  VOTING_FINALIZED = 'VOTING_FINALIZED',
  VOTING_DELETED = 'VOTING_DELETED',
  OPTION_ADDED = 'OPTION_ADDED',
  OPTION_UPDATED = 'OPTION_UPDATED',
  OPTION_REMOVED = 'OPTION_REMOVED',
  BALLOT_CAST = 'BALLOT_CAST', // userId MUST be null
  VOTING_TOKEN_ISSUED = 'VOTING_TOKEN_ISSUED', // add this line
  VOTING_RESULT_SEALED = 'VOTING_RESULT_SEALED',
  // ── Survey lifecycle ──────────────────────────────────────────────────────
  SURVEY_CREATED = 'SURVEY_CREATED',
  SURVEY_OPENED = 'SURVEY_OPENED',
  SURVEY_CLOSED = 'SURVEY_CLOSED',
  SURVEY_FINALIZED = 'SURVEY_FINALIZED',
  SURVEY_DELETED = 'SURVEY_DELETED',
  SURVEY_TOKEN_ISSUED = 'SURVEY_TOKEN_ISSUED',
  SURVEY_BALLOT_CAST = 'SURVEY_BALLOT_CAST', // userId MUST be null
  SURVEY_RESULT_SEALED = 'SURVEY_RESULT_SEALED',
  // ── Admin ─────────────────────────────────────────────────────────────────
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  GROUP_CREATED = 'GROUP_CREATED',
  GROUP_DELETED = 'GROUP_DELETED',
  MEMBER_ADDED = 'MEMBER_ADDED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  GROUP_UPDATED = 'GROUP_UPDATED',
  SURVEY_UPDATED = 'SURVEY_UPDATED',
  VOTING_UPDATED = 'VOTING_UPDATED',
}

/**
 * SECURITY actions → audit_security collection (no hash chain, TTL 90 days).
 * These are for suspicious-activity detection, not tamper-evident proof.
 */
export enum SecurityAction {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_REGISTERED = 'USER_REGISTERED',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  EMAIL_VERIFY_REQUESTED = 'EMAIL_VERIFY_REQUESTED',
  EMAIL_VERIFY_COMPLETED = 'EMAIL_VERIFY_COMPLETED',
}

export type AuditAction = ChainAction | SecurityAction;

export interface AuditChainDocument {
  _id?: unknown;
  sequence: number;
  action: ChainAction;
  payload: Record<string, unknown>;
  userId?: string | null;
  groupId?: string | null;
  votingId?: string | null;
  surveyId?: string | null;
  createdAt: Date;
  prevHash: string;
  hash: string;
}

/**
 * Stored in audit_security. No hash chain, expires after 90 days via TTL index.
 */
export interface AuditSecurityDocument {
  _id?: unknown;
  action: SecurityAction;
  payload: Record<string, unknown>;
  userId?: string | null;
  createdAt: Date;
}

// ─── Write Context (passed to AuditService) ───────────────────────────────────

export interface AuditChainContext {
  action: ChainAction;
  payload: Record<string, unknown>;
  userId?: string | null;
  groupId?: string | null;
  votingId?: string | null;
  surveyId?: string | null;
}

export interface AuditSecurityContext {
  action: SecurityAction;
  payload: Record<string, unknown>;
  userId?: string | null;
}

// ─── Verify result ────────────────────────────────────────────────────────────

export interface VerifyResult {
  valid: boolean;
  totalChecked: number;
  brokenAt: number | null;
  reason: string | null;
}
