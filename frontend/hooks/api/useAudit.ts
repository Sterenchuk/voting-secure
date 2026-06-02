import { useState, useCallback } from "react";
import { api, ApiError } from "./useApi";

const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

function getCacheKey(scope: string, scopeId?: string) {
  return `audit_integrity_cache:${scope}:${scopeId || "global"}`;
}

// ─── Audit log entry ──────────────────────────────────────────────────────────

export interface AuditLogEntry {
  sequence: number;
  groupSequence?: number | null;
  votingSequence?: number | null;
  surveySequence?: number | null;
  action: string;
  payload: Record<string, any>;
  userId?: string | null;
  groupId?: string | null;
  votingId?: string | null;
  surveyId?: string | null;
  createdAt: string;
  prevHash: string;
  groupPrevHash?: string | null;
  votingPrevHash?: string | null;
  surveyPrevHash?: string | null;
  hash: string;
}

// ─── Forensic metadata attached by getCompromisedBlocks ───────────────────────
//
// __breakRole:
//   'tampered' — this block's stored hash no longer matches its recomputed hash
//   'victim'   — this block is intact but its prevHash points to a corrupted predecessor
//
// Tampered block fields:
//   __corruptedHash  — the bad hash stored on the block (e.g. "HACKED_HASH_...")
//   __expectedHash   — what the hash should be (recomputed by the verifier)
//
// Victim block fields:
//   __victimPrevHash          — the prevHash the victim currently holds (= corrupted)
//   __victimExpectedPrevHash  — what it should point to (the good hash)

export interface ForensicAuditLogEntry extends AuditLogEntry {
  __breakRole?: "tampered" | "victim";
  __corruptedHash?: string;
  __expectedHash?: string | null;
  __victimPrevHash?: string;
  __victimExpectedPrevHash?: string | null;
}

// ─── Receipt verification ─────────────────────────────────────────────────────

export interface VerifyReceiptResult {
  found: boolean;
  sequence: number;
  blockHash: string;
  prevHash: string;
  timestamp: string;
  hash: string;
}

export interface VerifyReceiptResponse {
  valid: boolean;
  missingHashes?: string[];
  results: VerifyReceiptResult[];
}

// ─── Chain integrity result ───────────────────────────────────────────────────

export interface ChainIntegrityResult {
  valid: boolean;
  totalChecked: number;
  brokenAt: number | null;
  reason: string | null;
  scope?: "global" | "group" | "voting" | "survey";
  scopeId?: string;
  verifiedAt?: number;

  // Populated on any break
  errorType?: "TAMPERED_HASH" | "BROKEN_LINK";

  // TAMPERED_HASH — hash stored on a block ≠ recomputed hash
  expectedHash?: string;
  foundHash?: string;

  // BROKEN_LINK — a block's prevHash doesn't match the predecessor's hash
  expectedPrevHash?: string;
  foundPrevHash?: string;
}

// ─── Async job status ─────────────────────────────────────────────────────────

export interface VerificationJobStatus {
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  result?: ChainIntegrityResult;
  error?: string;
}

export interface AuditStatus {
  scope: string;
  scopeId: string | null;
  lastVerifiedSequence: number;
  maxSequence: number;
  lastFullVerificationAt: string | null;
  updatedAt: string | null;
  isSecure: boolean;
  reason: string | null;
}

// ─── Hook state ───────────────────────────────────────────────────────────────

interface AuditState {
  blocks: AuditLogEntry[];
  totalCount: number;
  loading: boolean;
  error: ApiError | null;
  integrity: ChainIntegrityResult | null;
  status: AuditStatus | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAudit() {
  const [state, setState] = useState<AuditState>({
    blocks: [],
    totalCount: 0,
    loading: false,
    error: null,
    integrity: null,
    status: null,
  });

  // ── Integrity cache ─────────────────────────────────────────────────────────

  const saveIntegrityToCache = useCallback((result: ChainIntegrityResult) => {
    const key = getCacheKey(result.scope || "global", result.scopeId);
    const data = { ...result, verifiedAt: Date.now() };
    setState((prev) => ({ ...prev, integrity: data }));
    localStorage.setItem(key, JSON.stringify(data));
  }, []);

  const loadIntegrityFromCache = useCallback(
    (scope: string, scopeId?: string) => {
      const key = getCacheKey(scope, scopeId);
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as ChainIntegrityResult;
          if (parsed.verifiedAt && Date.now() - parsed.verifiedAt < CACHE_TTL) {
            setState((prev) => ({ ...prev, integrity: parsed }));
            return parsed;
          } else {
            localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
      setState((prev) => ({ ...prev, integrity: null }));
      return null;
    },
    [],
  );

  const clearIntegrityCache = useCallback((scope: string, scopeId?: string) => {
    const key = getCacheKey(scope, scopeId);
    setState((prev) => ({ ...prev, integrity: null }));
    localStorage.removeItem(key);
  }, []);

  // ── Chain fetchers ──────────────────────────────────────────────────────────

  const fetchGlobalChain = useCallback(async (page = 1, pageSize = 20) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const response = await api.get<{
      records: AuditLogEntry[];
      totalCount: number;
    }>(`/audit?page=${page}&pageSize=${pageSize}`);

    if (response.data) {
      setState((prev) => ({
        ...prev,
        blocks: response.data!.records,
        totalCount: response.data!.totalCount,
        loading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, loading: false, error: response.error }));
    }
    return response;
  }, []);

  const fetchVotingChain = useCallback(
    async (
      votingId: string,
      page = 1,
      limit = 50,
      filters?: { hash?: string; sequence?: string; action?: string },
    ) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) queryParams.append(key, String(value));
        });
      }

      const response = await api.get<{
        records: AuditLogEntry[];
        totalCount: number;
      }>(`/audit/votings/audit-chain/${votingId}?${queryParams.toString()}`);

      if (response.data) {
        setState((prev) => ({
          ...prev,
          blocks: response.data!.records,
          totalCount: response.data!.totalCount,
          loading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: response.error,
        }));
      }
      return response;
    },
    [],
  );

  const fetchSurveyChain = useCallback(
    async (
      surveyId: string,
      page = 1,
      limit = 50,
      filters?: { hash?: string; sequence?: string; action?: string },
    ) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) queryParams.append(key, String(value));
        });
      }

      const response = await api.get<{
        records: AuditLogEntry[];
        totalCount: number;
      }>(`/audit/surveys/audit-chain/${surveyId}?${queryParams.toString()}`);

      if (response.data) {
        setState((prev) => ({
          ...prev,
          blocks: response.data!.records,
          totalCount: response.data!.totalCount,
          loading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: response.error,
        }));
      }
      return response;
    },
    [],
  );

  // ── Compromised blocks ──────────────────────────────────────────────────────
  //
  // forceFull=true bypasses the DB-level lastVerifiedSequence cache so the
  // verifier rescans from genesis — necessary when the tamper happened at a
  // sequence that was already marked as verified before the tampering occurred.

  const fetchCompromisedBlocks = useCallback(
    async (scope: "voting" | "survey", scopeId: string, forceFull = false) => {
      const response = await api.get<{ records: ForensicAuditLogEntry[] }>(
        `/audit/audit-chain/${scopeId}/compromised?scope=${scope}&forceFull=${forceFull}`,
      );
      return response;
    },
    [],
  );

  // ── Receipt verification ────────────────────────────────────────────────────

  const verifyReceipt = useCallback(
    async (
      entityId: string,
      hash: string | string[],
      type: "voting" | "survey" = "voting",
    ) => {
      const hashParam = Array.isArray(hash) ? hash.join(",") : hash;
      return api.get<VerifyReceiptResponse>(
        `/${type === "voting" ? "votings" : "surveys"}/${entityId}/verify-receipt?hash=${encodeURIComponent(hashParam)}`,
      );
    },
    [],
  );

  // ── Chain integrity ─────────────────────────────────────────────────────────

  const verifyScopedIntegrity = useCallback(
    async (
      scope: "global" | "group" | "voting" | "survey" = "global",
      scopeId?: string,
    ) => {
      let url = "/audit/verify";
      if (scope !== "global" && scopeId) {
        url = `/audit/verify/${scope}/${scopeId}`;
      }
      return api.get<{ jobId: string }>(url);
    },
    [],
  );

  const startAsyncVerification = useCallback(
    async (
      scope: "global" | "group" | "voting" | "survey",
      scopeId?: string,
      forceFull = false,
    ) => {
      return api.post<{ jobId: string }>("/audit/verify/start", {
        scope,
        scopeId,
        forceFull,
      });
    },
    [],
  );

  const getVerificationStatus = useCallback(async (jobId: string) => {
    return api.get<VerificationJobStatus>(`/audit/verify/status/${jobId}`);
  }, []);

  const getAuditStatus = useCallback(
    async (
      scope: "global" | "group" | "voting" | "survey",
      scopeId?: string,
    ) => {
      const queryParams = new URLSearchParams({ scope });
      if (scopeId) queryParams.append("scopeId", scopeId);

      const response = await api.get<AuditStatus>(
        `/audit/status?${queryParams.toString()}`,
      );
      if (response.data) {
        setState((prev) => ({ ...prev, status: response.data! }));
      }
      return response;
    },
    [],
  );

  // ── Global search ───────────────────────────────────────────────────────────

  const searchAudit = useCallback(
    async (params: {
      hash?: string;
      sequence?: number;
      action?: string;
      votingId?: string;
      surveyId?: string;
      userId?: string;
      page?: number;
      limit?: number;
    }) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          queryParams.append(key, String(value));
        }
      });

      const response = await api.get<{
        records: AuditLogEntry[];
        totalCount: number;
        page: number;
        limit: number;
      }>(`/audit/search?${queryParams.toString()}`);

      if (response.data) {
        setState((prev) => ({
          ...prev,
          blocks: response.data!.records,
          totalCount: response.data!.totalCount,
          loading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: response.error,
        }));
      }
      return response;
    },
    [],
  );

  return {
    ...state,
    fetchGlobalChain,
    fetchVotingChain,
    fetchSurveyChain,
    fetchCompromisedBlocks,
    verifyReceipt,
    verifyScopedIntegrity,
    startAsyncVerification,
    getVerificationStatus,
    getAuditStatus,
    searchAudit,
    saveIntegrityToCache,
    loadIntegrityFromCache,
    clearIntegrityCache,
  };
}
