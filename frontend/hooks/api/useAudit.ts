"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "./useApi";

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

export interface VerifyReceiptResult {
  found: boolean;
  chainSequence: number;
  blockHash: string;
  prevHash: string;
  timestamp: string;
}

export interface ChainIntegrityResult {
  valid: boolean;
  totalChecked: number;
  brokenAt: number | null;
  reason: string | null;
  scope?: "global" | "group" | "voting" | "survey";
  scopeId?: string;
}

interface AuditState {
  blocks: AuditLogEntry[];
  totalCount: number;
  loading: boolean;
  error: ApiError | null;
  integrity: ChainIntegrityResult | null;
}

export function useAudit() {
  const [state, setState] = useState<AuditState>({
    blocks: [],
    totalCount: 0,
    loading: false,
    error: null,
    integrity: null,
  });

  const fetchGlobalChain = useCallback(async (page = 1, pageSize = 20) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const response = await api.get<{ records: AuditLogEntry[]; totalCount: number }>(
      `/audit?page=${page}&pageSize=${pageSize}`
    );

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

  const fetchVotingChain = useCallback(async (votingId: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const response = await api.get<AuditLogEntry[]>(`/audit/votings/${votingId}/audit-chain`);

    if (response.data) {
      setState((prev) => ({
        ...prev,
        blocks: response.data!,
        totalCount: response.data!.length,
        loading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, loading: false, error: response.error }));
    }
    return response;
  }, []);

  const verifyReceipt = useCallback(async (votingId: string, hash: string) => {
    return api.get<VerifyReceiptResult>(
      `/votings/${votingId}/verify-receipt?hash=${hash}`
    );
  }, []);

  const verifyScopedIntegrity = useCallback(
    async (scope: "global" | "group" | "voting" | "survey" = "global", scopeId?: string) => {
      let url = "/audit/verify";
      if (scope !== "global" && scopeId) {
        url = `/audit/verify/${scope}/${scopeId}`;
      }

      const response = await api.get<ChainIntegrityResult>(url);
      if (response.data) {
        setState((prev) => ({ ...prev, integrity: response.data! }));
      }
      return response;
    },
    []
  );

  return {
    ...state,
    fetchGlobalChain,
    fetchVotingChain,
    verifyReceipt,
    verifyScopedIntegrity,
  };
}
