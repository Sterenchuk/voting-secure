"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "./useApi";
import { SurveyQuestionType } from "@/types/survey";

export interface SurveyChoiceConfig {
  id: string;
  allowOther: boolean;
  allowMultiple: boolean;
  minChoices: number | null;
  maxChoices: number | null;
}

export interface SurveyScaleConfig {
  id: string;
  scaleMin: number;
  scaleMax: number;
  step: number;
}

export interface SurveyOption {
  id: string;
  text: string;
  order: number;
}

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  text: string;
  isRequired: boolean;
  order: number;
  choiceConfig?: SurveyChoiceConfig;
  scaleConfig?: SurveyScaleConfig;
  options: SurveyOption[];
}

export interface Survey {
  id: string;
  creatorId: string;
  groupId: string;
  groupName: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  isFinalized: boolean;
  startAt: string | null;
  endAt: string | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  questions: SurveyQuestion[];
  status: "draft" | "active" | "completed";
  responsesCount: number;
  allowAbstain: boolean;
  hasParticipated?: boolean;
  userGroupRole?: string;
}

export interface SurveyAnswer {
  questionId: string;
  type: SurveyQuestionType;
  optionIds?: string[];
  scale?: number;
  text?: string;
}

interface SurveyBallotInput {
  questionId: string;
  optionIds?: string[];
  text?: string;
}

interface SubmitSurveyPayload {
  ballots: SurveyBallotInput[];
  token?: string;
  isAbstention?: boolean;
  isPractice?: boolean;
}

export interface SurveyQuestionResult {
  questionId: string;
  options: { id: string; text: string; count: number }[];
  totalVotes?: number;
  otherCount?: number;
  freeformAnswers?: string[];
}

export interface SurveyResults {
  surveyId: string;
  totalResponses: number;
  results: SurveyQuestionResult[];
}

export interface CreateSurveyData {
  title: string;
  description?: string;
  groupId: string;
  isPublic?: boolean;
  allowAbstain?: boolean;
  startAt?: string;
  endAt?: string;
  questions: Array<{
    type: SurveyQuestionType;
    text: string;
    isRequired?: boolean;
    order?: number;
    options?: Array<{ text: string; order: number }>;
    choiceConfig?: Partial<SurveyChoiceConfig>;
    scaleConfig?: Partial<SurveyScaleConfig>;
  }>;
}

interface SurveysState {
  surveys: Survey[];
  currentSurvey: Survey | null;
  results: SurveyResults | null;
  loading: boolean;
  error: ApiError | null;
}

const mapSurvey = (s: any): Survey => {
  const now = new Date();
  const endAt = s.endAt ? new Date(s.endAt) : null;

  let status: Survey["status"] = "draft";
  if (s.isFinalized || (endAt && endAt < now)) status = "completed";
  else if (s.isPublic) status = "active";

  const questions: SurveyQuestion[] = (s.questions ?? []).map(
    (q: any): SurveyQuestion => ({
      id: q.id,
      type: q.type as SurveyQuestionType,
      text: q.text,
      isRequired: q.isRequired ?? true,
      order: q.order ?? 0,
      choiceConfig: q.choiceConfig ?? undefined,
      scaleConfig: q.scaleConfig ?? undefined,
      options: (q.options ?? []).map(
        (o: any): SurveyOption => ({
          id: o.id,
          text: o.text,
          order: o.order ?? 0,
        }),
      ),
    }),
  );

  return {
    id: s.id,
    creatorId: s.creatorId,
    groupId: s.groupId,
    groupName: s.group?.name ?? "",
    title: s.title,
    description: s.description ?? null,
    isPublic: s.isPublic,
    isFinalized: s.isFinalized,
    startAt: s.startAt ?? null,
    endAt: s.endAt ?? null,
    finalizedAt: s.finalizedAt ?? null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    questions,
    status,
    responsesCount: s.responsesCount ?? s._count?.participations ?? 0,
    allowAbstain: s.allowAbstain ?? false,
    hasParticipated: s.hasParticipated,
    userGroupRole: s.userGroupRole,
  };
};

const buildBallots = (
  surveyId: string,
  answers: SurveyAnswer[],
): SurveyBallotInput[] => {
  const ballots: SurveyBallotInput[] = [];

  for (const answer of answers) {
    switch (answer.type) {
      case SurveyQuestionType.SINGLE_CHOICE:
        ballots.push({
          questionId: answer.questionId,
          optionIds: answer.optionIds?.[0] ? [answer.optionIds[0]] : [],
          text: answer.text,
        });
        break;

      case SurveyQuestionType.MULTIPLE_CHOICE:
        ballots.push({
          questionId: answer.questionId,
          optionIds: answer.optionIds ?? [],
          text: answer.text,
        });
        break;

      case SurveyQuestionType.SCALE: {
        const scaleValue = String(answer.scale ?? 0);
        ballots.push({
          questionId: answer.questionId,
          optionIds: [scaleValue],
        });
        break;
      }

      case SurveyQuestionType.FREEFORM:
        if (answer.text) {
          ballots.push({
            questionId: answer.questionId,
            text: answer.text,
          });
        }
        break;
    }
  }

  return ballots;
};

export function useSurveys() {
  const [state, setState] = useState<SurveysState>({
    surveys: [],
    currentSurvey: null,
    results: null,
    loading: false,
    error: null,
  });

  const fetchSurveys = useCallback(
    async (filters?: { groupId?: string; isPublic?: boolean }) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const queryParams = new URLSearchParams();
      if (filters?.groupId) queryParams.append("groupId", filters.groupId);
      if (filters?.isPublic !== undefined)
        queryParams.append("isPublic", String(filters.isPublic));

      const url = `/surveys${queryParams.toString() ? `?${queryParams}` : ""}`;
      const response = await api.get<any[]>(url);

      if (response.data) {
        setState((prev) => ({
          ...prev,
          surveys: response.data!.map(mapSurvey),
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

  const fetchSurvey = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await api.get<any>(`/surveys/${id}`);

    if (response.data) {
      setState((prev) => ({
        ...prev,
        currentSurvey: mapSurvey(response.data),
        loading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, loading: false, error: response.error }));
    }

    return response;
  }, []);

  const fetchResults = useCallback(async (id: string) => {
    const response = await api.get<SurveyResults>(`/surveys/${id}/results`);
    if (response.data) {
      setState((prev) => ({ ...prev, results: response.data! }));
    }
    return response;
  }, []);

  const syncResults = useCallback((data: SurveyResults) => {
    if (data?.results) {
      setState((prev) => ({ ...prev, results: data }));
    }
  }, []);

  const createSurvey = useCallback(async (data: CreateSurveyData) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await api.post<any>("/surveys", data);

    if (response.data) {
      const mapped = mapSurvey(response.data);
      setState((prev) => ({
        ...prev,
        surveys: [mapped, ...prev.surveys],
        loading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, loading: false, error: response.error }));
    }

    return response;
  }, []);

  const requestToken = useCallback(
    async (
      surveyId: string,
      answers: SurveyAnswer[],
      isAbstention = false,
      isPractice = false,
    ) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const ballots = buildBallots(surveyId, answers);

      const response = await api.post<{ status: string; token?: string }>(
        `/surveys/${surveyId}/token`,
        { ballots, isAbstention, isPractice },
      );

      setState((prev) => ({
        ...prev,
        loading: false,
        error: response.error ?? null,
      }));
      return response;
    },
    [],
  );

  const practiceSubmit = useCallback(
    async (surveyId: string, answers: SurveyAnswer[]) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const ballots = buildBallots(surveyId, answers);

      // Step 1: request token in practice mode
      const tokenRes = await api.post<{ status: string; token?: string }>(
        `/surveys/${surveyId}/token`,
        { ballots, isPractice: true },
      );

      if (!tokenRes.data?.token) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: tokenRes.error ?? null,
        }));
        return tokenRes;
      }

      // Step 2: submit immediately using the returned token
      const payload: SubmitSurveyPayload = {
        ballots,
        token: tokenRes.data.token,
        isAbstention: false,
        isPractice: true,
      };

      const submitRes = await api.post<any>(
        `/surveys/${surveyId}/submit`,
        payload,
      );

      if (submitRes.data) {
        const refreshed = await api.get<any>(`/surveys/${surveyId}`);
        if (refreshed.data) {
          const mapped = mapSurvey(refreshed.data);
          setState((prev) => ({
            ...prev,
            currentSurvey: mapped,
            surveys: prev.surveys.map((s) => (s.id === surveyId ? mapped : s)),
            loading: false,
          }));
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: submitRes.error ?? null,
        }));
      }

      return submitRes;
    },
    [],
  );

  const getMyStatus = useCallback(async (surveyId: string) => {
    return api.get<{ submitted: boolean; receipts?: string[] }>(
      `/surveys/${surveyId}/my-status`,
    );
  }, []);

  const fetchParticipationStats = useCallback(async (surveyId: string) => {
    return api.get<Array<{ time: string; votes: number }>>(
      `/surveys/${surveyId}/participation-stats`,
    );
  }, []);

  const finalizeSurvey = useCallback(async (surveyId: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const response = await api.post<any>(`/surveys/${surveyId}/finalize`);
    setState((prev) => ({
      ...prev,
      loading: false,
      error: response.error ?? null,
    }));
    return response;
  }, []);

  const verifyReceipt = useCallback(async (surveyId: string, hash: string) => {
    return api.get<any>(`/surveys/${surveyId}/verify-receipt?hash=${hash}`);
  }, []);

  const submitSurvey = useCallback(
    async (
      surveyId: string,
      answers: SurveyAnswer[],
      token?: string,
      isAbstention = false,
      isPractice = false,
    ) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const ballots = buildBallots(surveyId, answers);
      const payload: SubmitSurveyPayload = {
        ballots,
        token,
        isAbstention,
        isPractice,
      };

      const response = await api.post<any>(
        `/surveys/${surveyId}/submit`,
        payload,
      );

      if (response.data) {
        const refreshed = await api.get<any>(`/surveys/${surveyId}`);
        if (refreshed.data) {
          const mapped = mapSurvey(refreshed.data);
          setState((prev) => ({
            ...prev,
            currentSurvey: mapped,
            surveys: prev.surveys.map((s) => (s.id === surveyId ? mapped : s)),
            loading: false,
          }));
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: response.error ?? null,
        }));
      }

      return response;
    },
    [],
  );

  const deleteSurvey = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await api.delete(`/surveys/${id}`);

    if (!response.error) {
      setState((prev) => ({
        ...prev,
        surveys: prev.surveys.filter((s) => s.id !== id),
        currentSurvey:
          prev.currentSurvey?.id === id ? null : prev.currentSurvey,
        loading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, loading: false, error: response.error }));
    }

    return response;
  }, []);

  return {
    ...state,
    fetchSurveys,
    fetchSurvey,
    fetchResults,
    syncResults,
    createSurvey,
    requestToken,
    practiceSubmit,
    getMyStatus,
    fetchParticipationStats,
    finalizeSurvey,
    verifyReceipt,
    submitSurvey,
    deleteSurvey,
  };
}

export default useSurveys;
