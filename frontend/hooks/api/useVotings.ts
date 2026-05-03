"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "./useApi";
import { VotingType } from "@/types/voting";
import { socketService } from "@/lib/socket/socketService";

export interface VotingOption {
  id: string;
  text: string;
  voteCount: number;
  percentage: number;
}

export interface AuditProof {
  chainSequence: number;
  chainHash: string;
  verifyUrl: string;
  chainUrl: string;
}

export interface Voting {
  id: string;
  creatorId: string;
  groupId: string;
  groupName: string; // from group.name relation
  title: string;
  description: string | null;
  type: VotingType;
  isOpen: boolean;
  isFinalized: boolean;
  allowOther: boolean;
  minChoices: number;
  maxChoices: number | null;
  startAt: string | null; // ISO string on the wire
  endAt: string | null;
  finalizedAt: string | null;
  createdAt: string;
  options: VotingOption[];
  totalVotes: number;
  participantsCount: number;
  abstentionsCount: number;
  hasVoted?: boolean;
  otherTotal?: number;
  dynamicOptions?: VotingOption[];
  // derived status for UI
  status: "draft" | "active" | "upcoming" | "completed";
}

export interface CreateVotingData {
  title: string;
  description?: string;
  groupId: string;
  type?: VotingType;
  isOpen?: boolean;
  allowOther?: boolean;
  minChoices?: number;
  maxChoices?: number;
  options: string[]; // min 2 items, backend trims
  startAt?: string; // ISO date string
  endAt?: string;
}

export interface CastVoteData {
  votingId: string;
  token: string; // The raw secret token
  optionIds: string[];
  otherText?: string;
  isAbstention?: boolean;
}

export interface CastVoteResponse {
  participated: true;
  receipts: string[];
  proof: {
    verifyUrl: string;
    chainUrl: string;
  };
}

interface VotingsState {
  votings: Voting[];
  currentVoting: Voting | null;
  results: any | null;
  loading: boolean;
  error: ApiError | null;
}

// ── Maps raw backend IVotingDetail response → typed Voting ────────────────────
const mapVoting = (v: any): Voting => {
  const options: VotingOption[] = (v.options ?? []).map((opt: any) => ({
    id: opt.id,
    text: opt.text,
    voteCount: opt.voteCount ?? 0,
    percentage: 0,
  }));

  const dynamicOptions: VotingOption[] = (v.dynamicOptions ?? []).map((opt: any) => ({
    id: opt.id,
    text: opt.text,
    voteCount: opt.voteCount ?? 0,
    percentage: 0,
  }));

  const otherTotal = v.otherTotal ?? 0;

  // totalVotes calculated from options + other
  const totalVotes = options.reduce((sum, o) => sum + o.voteCount, 0) + otherTotal;

  // participantsCount from backend _count or provided field
  const participantsCount =
    v.participantsCount ?? v._count?.participations ?? totalVotes;

  options.forEach((o) => {
    o.percentage = totalVotes > 0 ? (o.voteCount / totalVotes) * 100 : 0;
  });

  const now = new Date();
  const startAt = v.startAt ? new Date(v.startAt) : null;
  let status: Voting["status"] = "draft";
  if (v.isFinalized) status = "completed";
  else if (v.isOpen) status = "active";
  else if (startAt && startAt > now) status = "upcoming";

  return {
    id: v.id,
    creatorId: v.creatorId,
    groupId: v.groupId,
    groupName: v.group?.name ?? "",
    title: v.title,
    description: v.description ?? null,
    type: v.type ?? "SINGLE_CHOICE",
    isOpen: v.isOpen,
    isFinalized: v.isFinalized,
    allowOther: v.allowOther ?? false,
    minChoices: v.minChoices ?? 1,
    maxChoices: v.maxChoices ?? null,
    startAt: v.startAt ?? null,
    endAt: v.endAt ?? null,
    finalizedAt: v.finalizedAt ?? null,
    createdAt: v.createdAt,
    options,
    totalVotes,
    participantsCount,
    abstentionsCount: v.abstentionsCount ?? 0,
    hasVoted: v.hasVoted,
    otherTotal,
    dynamicOptions,
    status,
  };
};

export function useVotings() {
  const [state, setState] = useState<VotingsState>({
    votings: [],
    currentVoting: null,
    results: null,
    loading: false,
    error: null,
  });

  const fetchVotings = useCallback(
    async (filters?: {
      groupId?: string;
      title?: string;
      isOpen?: boolean;
    }) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const queryParams = new URLSearchParams();
      if (filters?.groupId) queryParams.append("groupId", filters.groupId);
      if (filters?.title) queryParams.append("title", filters.title);
      if (filters?.isOpen !== undefined)
        queryParams.append("isOpen", String(filters.isOpen));

      const url = `/votings${queryParams.toString() ? `?${queryParams}` : ""}`;
      const response = await api.get<any[]>(url);

      if (response.data) {
        setState((prev) => ({
          ...prev,
          votings: response.data!.map(mapVoting),
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

  const fetchVoting = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await api.get<any>(`/votings/${id}`);

    if (response.data) {
      setState((prev) => ({
        ...prev,
        currentVoting: mapVoting(response.data),
        loading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, loading: false, error: response.error }));
    }

    return response;
  }, []);

  const fetchResults = useCallback(async (id: string) => {
    const response = await api.get<any>(`/votings/${id}/results`);
    if (response.data) {
      setState((prev) => ({ ...prev, results: response.data }));
    }
    return response;
  }, []);

  const fetchSealedResults = useCallback(async (id: string) => {
    const response = await api.get<any>(`/votings/${id}/results/sealed`);
    if (response.data) {
      setState((prev) => ({ ...prev, results: response.data }));
    }
    return response;
  }, []);

  const createVoting = useCallback(async (data: CreateVotingData) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await api.post<any>("/votings", data);

    if (response.data) {
      const mapped = mapVoting(response.data);
      setState((prev) => ({
        ...prev,
        votings: [mapped, ...prev.votings],
        loading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, loading: false, error: response.error }));
    }

    return response;
  }, []);

  const requestToken = useCallback(
    async (votingId: string, optionIds: string[], otherText?: string, isAbstention?: boolean) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const response = await api.post<{
        status: string;
        message: string;
      }>(`/votings/${votingId}/token`, { optionIds, otherText, isAbstention });
      setState((prev) => ({ ...prev, loading: false, error: response.error }));
      return response;
    },
    [],
  );

  const castVote = useCallback(async (data: CastVoteData) => {
    try {
      const response = await api.post<CastVoteResponse>(
        `/votings/${data.votingId}/vote`,
        {
          token: data.token,
          ballots: data.optionIds.map((id) => ({ optionId: id })),
          otherText: data.otherText,
          isAbstention: data.isAbstention,
        },
      );

      if (response.data) {
        return { data: response.data, error: null, status: 200 };
      } else {
        throw new Error(response.error?.message || "Failed to cast vote");
      }
    } catch (err: any) {
      const error: ApiError = { message: err.message || "Failed to cast vote" };
      setState((prev) => ({ ...prev, error }));
      return { data: null, error, status: 500 };
    }
  }, []);

  const deleteVoting = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await api.delete(`/votings/${id}`);

    if (!response.error) {
      setState((prev) => ({
        ...prev,
        votings: prev.votings.filter((v) => v.id !== id),
        currentVoting:
          prev.currentVoting?.id === id ? null : prev.currentVoting,
        loading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, loading: false, error: response.error }));
    }

    return response;
  }, []);

  const updateVotingResults = useCallback((voting: Voting) => {
    setState((prev) => ({
      ...prev,
      currentVoting:
        prev.currentVoting?.id === voting.id ? voting : prev.currentVoting,
      votings: prev.votings.map((v) => (v.id === voting.id ? voting : v)),
    }));
  }, []);

  const syncResults = useCallback(
    (data: { votingId: string; results: any }) => {
      setState((prev) => {
        if (!prev.currentVoting || prev.currentVoting.id !== data.votingId)
          return prev;

        const results = data.results;
        const updatedOptions = prev.currentVoting.options.map((opt) => {
          const match = results.options?.find((r: any) => r.id === opt.id);
          return match ? { ...opt, voteCount: match.voteCount } : opt;
        });

        const updatedDynamicOptions: VotingOption[] = (
          results.dynamicOptions ?? []
        ).map((opt: any) => ({
          id: opt.id,
          text: opt.text,
          voteCount: opt.voteCount ?? 0,
          percentage: 0,
        }));

        const otherTotal = results.otherTotal ?? 0;
        const abstentionsCount = results.abstentionsCount ?? 0;

        const totalVotes =
          updatedOptions.reduce((sum, o) => sum + o.voteCount, 0) + otherTotal + abstentionsCount;

        updatedOptions.forEach((o) => {
          o.percentage = totalVotes > 0 ? (o.voteCount / totalVotes) * 100 : 0;
        });

        const updated = {
          ...prev.currentVoting,
          options: updatedOptions,
          totalVotes,
          otherTotal,
          dynamicOptions: updatedDynamicOptions,
          abstentionsCount,
        };

        return {
          ...prev,
          currentVoting: updated,
          votings: prev.votings.map((v) => (v.id === updated.id ? updated : v)),
        };
      });
    },
    [],
  );

  const updateVotingState = useCallback((partial: Partial<Voting>) => {
    setState((prev) => {
      if (!prev.currentVoting) return prev;
      const updated = { ...prev.currentVoting, ...partial };
      return {
        ...prev,
        currentVoting: updated,
        votings: prev.votings.map((v) => (v.id === updated.id ? updated : v)),
      };
    });
  }, []);

  const verifyReceipt = useCallback(async (votingId: string, hash: string) => {
    return api.get<{
      found: boolean;
      sequence?: number;
      blockHash?: string;
      prevHash?: string;
    }>(`/votings/${votingId}/verify-receipt?hash=${encodeURIComponent(hash)}`);
  }, []);

  return {
    ...state,
    fetchVotings,
    fetchVoting,
    fetchResults,
    fetchSealedResults,
    createVoting,
    requestToken,
    castVote,
    deleteVoting,
    updateVotingResults,
    syncResults,
    updateVotingState,
    verifyReceipt,
  };
}

export default useVotings;
