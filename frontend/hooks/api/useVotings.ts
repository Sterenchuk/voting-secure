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
  groupName: string;
  title: string;
  description: string | null;
  type: VotingType;
  isPublic: boolean;
  isFinalized: boolean;
  allowOther: boolean;
  allowAbstain: boolean;
  minChoices: number;
  maxChoices: number | null;
  startAt: string | null;
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
  status: "draft" | "active" | "upcoming" | "completed";
  userGroupRole?: string;
}

export interface CreateVotingData {
  title: string;
  description?: string;
  groupId: string;
  type?: VotingType;
  isPublic?: boolean;
  allowOther?: boolean;
  allowAbstain?: boolean;
  minChoices?: number;
  maxChoices?: number;
  options: string[];
  startAt?: string;
  endAt?: string;
}

export interface CastVoteData {
  votingId: string;
  token: string;
  optionIds: string[];
  otherText?: string;
  isAbstention?: boolean;
  isPractice?: boolean;
}

export interface CastVoteResponse {
  participated: true;
  receipts: string[];
  emailSent: boolean;
  isPractice?: boolean;
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

const mapVoting = (v: any): Voting => {
  const options: VotingOption[] = (v.options ?? []).map((opt: any) => ({
    id: opt.id,
    text: opt.text,
    voteCount: opt.voteCount ?? 0,
    percentage: 0,
  }));

  const dynamicOptions: VotingOption[] = (v.dynamicOptions ?? []).map(
    (opt: any) => ({
      id: opt.id,
      text: opt.text,
      voteCount: opt.voteCount ?? 0,
      percentage: 0,
    }),
  );

  const otherTotal = v.otherTotal ?? 0;
  const abstentionsCount = v.abstentionsCount ?? 0;
  const totalVotes =
    options.reduce((sum, o) => sum + o.voteCount, 0) + otherTotal + abstentionsCount;
  const participantsCount =
    v.participantsCount ?? v._count?.participations ?? 0;

  options.forEach((o) => {
    o.percentage = totalVotes > 0 ? (o.voteCount / totalVotes) * 100 : 0;
  });

  const now = new Date();
  const startAt = v.startAt ? new Date(v.startAt) : null;
  const endAt = v.endAt ? new Date(v.endAt) : null;

  const isPublic =
    !v.isFinalized && startAt && now >= startAt && (!endAt || now <= endAt);
  let status: Voting["status"] = "draft";

  if (v.isFinalized) status = "completed";
  else if (isPublic) status = "active";
  else if (startAt && startAt > now) status = "upcoming";
  else if (endAt && now > endAt) status = "completed";

  return {
    id: v.id,
    creatorId: v.creatorId,
    groupId: v.groupId,
    groupName: v.group?.name ?? "",
    title: v.title,
    description: v.description ?? null,
    type: v.type ?? "SINGLE_CHOICE",
    isPublic: v.isPublic,
    isFinalized: v.isFinalized,
    allowOther: v.allowOther ?? false,
    allowAbstain: v.allowAbstain ?? false,
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
    userGroupRole: v.userGroupRole,
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
      isPublic?: boolean;
    }) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const queryParams = new URLSearchParams();
      if (filters?.groupId) queryParams.append("groupId", filters.groupId);
      if (filters?.title) queryParams.append("title", filters.title);
      if (filters?.isPublic !== undefined)
        queryParams.append("isPublic", String(filters.isPublic));

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
    async (
      votingId: string,
      optionIds: string[],
      otherText?: string,
      isAbstention?: boolean,
      isPractice?: boolean,
    ) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const response = await api.post<{
        status: string;
        message: string;
        token?: string;
      }>(`/votings/${votingId}/token`, {
        optionIds,
        otherText,
        isAbstention,
        isPractice,
      });
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
          optionIds: data.optionIds,
          otherText: data.otherText,
          isAbstention: data.isAbstention,
          isPractice: data.isPractice,
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
          updatedOptions.reduce((sum, o) => sum + o.voteCount, 0) +
          otherTotal +
          abstentionsCount;

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
          participantsCount: results.totalBallots,
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

  const fetchParticipationStats = useCallback(async (id: string) => {
    return api.get<Array<{ time: string; votes: number }>>(
      `/votings/${id}/participation-stats`,
    );
  }, []);

  const fetchGlobalStats = useCallback(async () => {
    return api.get<{
      totalVotes: number;
      activeVotings: number;
      participationRate: number;
      avgTurnout: number;
    }>("/votings/global/stats");
  }, []);

  const fetchGlobalTrends = useCallback(async () => {
    return api.get<Array<{ timestamp: string; count: number }>>(
      "/votings/global/trends",
    );
  }, []);

  const fetchRecentActivity = useCallback(async (limit = 5) => {
    return api.get<any[]>(`/votings/recent-activity?limit=${limit}`);
  }, []);

  const finalizeVoting = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const response = await api.post(`/votings/${id}/finalize`, {});
    if (!response.error) {
      setState((prev) => ({
        ...prev,
        votings: prev.votings.map((v) =>
          v.id === id ? { ...v, isFinalized: true, status: "completed" } : v,
        ),
        currentVoting:
          prev.currentVoting?.id === id
            ? { ...prev.currentVoting, isFinalized: true, status: "completed" }
            : prev.currentVoting,
        loading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, loading: false, error: response.error }));
    }
    return response;
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
    finalizeVoting,
    deleteVoting,
    updateVotingResults,
    syncResults,
    updateVotingState,
    verifyReceipt,
    fetchParticipationStats,
    fetchGlobalStats,
    fetchGlobalTrends,
    fetchRecentActivity,
  };
}

export default useVotings;
