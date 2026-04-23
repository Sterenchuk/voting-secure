"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "./useApi";
import { generateBallotHash } from "@/lib/security/crypto";
import { VotingType } from "@/types/voting";
import { socketService } from "@/lib/socket/socketService";

export interface VotingOption {
  id: string;
  text: string;
  voteCount: number;
  percentage: number;
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
  hasVoted?: boolean;
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

// ── Mirrors CastVoteDto ───────────────────────────────────────────────────────
export interface CastVoteData {
  votingId: string;
  optionIds: string[]; // supports both single and multiple choice
  otherText?: string; // maps to CastVoteDto.otherText
  freeformBallotHash?: string;
}

interface VotingsState {
  votings: Voting[];
  currentVoting: Voting | null;
  loading: boolean;
  error: ApiError | null;
}

// ── Maps raw backend IVotingDetail response → typed Voting ────────────────────
const mapVoting = (v: any): Voting => {
  const options: VotingOption[] = (v.options ?? []).map((opt: any) => ({
    id: opt.id,
    text: opt.text,
    voteCount: opt.voteCount ?? 0,
    percentage: 0, // filled below after totalVotes is known
  }));

  const totalVotes = options.reduce((sum, o) => sum + o.voteCount, 0);
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
    participantsCount: v.participantsCount ?? totalVotes,
    hasVoted: v.hasVoted,
    status,
  };
};

export function useVotings() {
  const [state, setState] = useState<VotingsState>({
    votings: [],
    currentVoting: null,
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

  const castVote = useCallback(async (data: CastVoteData) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const ballots = await Promise.all(
        data.optionIds.map(async (optionId) => ({
          optionId,
          ballotHash: await generateBallotHash(data.votingId, optionId),
        })),
      );

      const response = await socketService.castVote({
        votingId: data.votingId,
        ballots,
        ...(data.otherText && { otherText: data.otherText }),
        ...(data.freeformBallotHash && {
          freeformBallotHash: data.freeformBallotHash,
        }),
      });

      if (response) {
        const refreshed = await api.get<any>(`/votings/${data.votingId}`);
        if (refreshed.data) {
          const mapped = mapVoting(refreshed.data);
          setState((prev) => ({
            ...prev,
            currentVoting: mapped,
            votings: prev.votings.map((v) =>
              v.id === data.votingId ? mapped : v,
            ),
            loading: false,
          }));
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }
        return { data: response, error: null, status: 200 };
      }
    } catch (err: any) {
      const error: ApiError = { message: err.message || "Failed to cast vote" };
      setState((prev) => ({ ...prev, loading: false, error }));
      return { data: null, error, status: 500 };
    }

    return { data: null, error: { message: "Unknown error" }, status: 500 };
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

  return {
    ...state,
    fetchVotings,
    fetchVoting,
    createVoting,
    castVote,
    deleteVoting,
    updateVotingResults,
  };
}

export default useVotings;
