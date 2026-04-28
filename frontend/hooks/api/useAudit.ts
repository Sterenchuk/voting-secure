"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "./useApi";

export interface AuditRecord {
  _id?: string;
  sequence: number;
  action: string;
  payload: Record<string, any>;
  userId: string | null;
  groupId: string | null;
  votingId: string | null;
  surveyId: string | null;
  createdAt: string;
  prevHash: string;
  hash: string;
}

export interface AuditVerification {
  valid: boolean;
  totalChecked: number;
  brokenAt: number | null;
  reason: string | null;
}

interface AuditState {
  records: AuditRecord[];
  currentRecord: AuditRecord | null;
  verification: AuditVerification | null;
  loading: boolean;
  error: ApiError | null;
  totalCount: number;
  page: number;
  pageSize: number;
}

export function useAudit() {
  const [state, setState] = useState<AuditState>({
    records: [],
    currentRecord: null,
    verification: null,
    loading: false,
    error: null,
    totalCount: 0,
    page: 1,
    pageSize: 20,
  });

  const fetchAuditRecords = useCallback(
    async (filters?: {
      entityType?: string;
      entityId?: string;
      page?: number;
      pageSize?: number;
    }) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const queryParams = new URLSearchParams();
      if (filters?.entityType)
        queryParams.append("entityType", filters.entityType);
      if (filters?.entityId) queryParams.append("entityId", filters.entityId);
      if (filters?.page) queryParams.append("page", filters.page.toString());
      if (filters?.pageSize)
        queryParams.append("pageSize", filters.pageSize.toString());

      const url = `/audit${queryParams.toString() ? `?${queryParams}` : ""}`;
      const response = await api.get<{
        records: AuditRecord[];
        totalCount: number;
        page: number;
        pageSize: number;
      }>(url);

      if (response.data) {
        setState((prev) => ({
          ...prev,
          records: response.data!.records,
          totalCount: response.data!.totalCount,
          page: response.data!.page,
          pageSize: response.data!.pageSize,
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

  const fetchAuditRecord = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await api.get<{ record: AuditRecord }>(`/audit/${id}`);

    if (response.data) {
      setState((prev) => ({
        ...prev,
        currentRecord: response.data!.record,
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
  }, []);

  const verifyChain = useCallback(async (groupId?: string) => {
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      verification: null,
    }));

    const url = groupId ? `/audit/verify/${groupId}` : "/audit/verify";
    const response = await api.get<AuditVerification>(url);

    if (response.data) {
      setState((prev) => ({
        ...prev,
        verification: response.data,
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
  }, []);

  const searchAuditByHash = useCallback(async (hash: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await api.get<{ record: AuditRecord }>(
      `/audit/hash/${hash}`,
    );

    if (response.data) {
      setState((prev) => ({
        ...prev,
        currentRecord: response.data!.record,
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
  }, []);

  const clearVerification = useCallback(() => {
    setState((prev) => ({ ...prev, verification: null }));
  }, []);

  return {
    ...state,
    fetchAuditRecords,
    fetchAuditRecord,
    verifyChain,
    searchAuditByHash,
    clearVerification,
  };
}

export default useAudit;
