"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "./useApi";
import { generateSurveyBallotHash } from "@/lib/security/crypto";
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
  isOpen: boolean;
  isFinalized: boolean;
  startAt: string | null;
  endAt: string | null;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  questions: SurveyQuestion[];
  status: "draft" | "active" | "completed";
  responsesCount: number;
  hasParticipated?: boolean;
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
  optionId?: string;
  text?: string;
  ballotHash: string;
}

interface SubmitSurveyPayload {
  ballots: SurveyBallotInput[];
}

export interface CreateSurveyData {
  title: string;
  description?: string;
  groupId: string;
  isOpen?: boolean;
  startAt?: string;
  endAt?: string;
  questions: Array<{
    type: SurveyQuestionType;
    text: string;
    isRequired?: boolean;
    order?: number;
    options?: string[];
    choiceConfig?: Partial<SurveyChoiceConfig>;
    scaleConfig?: Partial<SurveyScaleConfig>;
  }>;
}

interface SurveysState {
  surveys: Survey[];
  currentSurvey: Survey | null;
  loading: boolean;
  error: ApiError | null;
}

const mapSurvey = (s: any): Survey => {
  const now = new Date();
  const endAt = s.endAt ? new Date(s.endAt) : null;

  let status: Survey["status"] = "draft";
  if (s.isFinalized || (endAt && endAt < now)) status = "completed";
  else if (s.isOpen) status = "active";

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
    isOpen: s.isOpen,
    isFinalized: s.isFinalized,
    startAt: s.startAt ?? null,
    endAt: s.endAt ?? null,
    finalizedAt: s.finalizedAt ?? null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    questions,
    status,
    responsesCount: s.responsesCount ?? s._count?.participations ?? 0,
    hasParticipated: s.hasParticipated,
  };
};

const buildBallots = async (
  surveyId: string,
  answers: SurveyAnswer[],
): Promise<SurveyBallotInput[]> => {
  const ballots: SurveyBallotInput[] = [];

  for (const answer of answers) {
    switch (answer.type) {
      case SurveyQuestionType.SINGLE_CHOICE:
        if (answer.optionIds?.[0]) {
          ballots.push({
            questionId: answer.questionId,
            optionId: answer.optionIds[0],
            ballotHash: await generateSurveyBallotHash(
              surveyId,
              answer.questionId,
              answer.optionIds[0],
            ),
          });
        }
        break;

      case SurveyQuestionType.MULTIPLE_CHOICE:
        for (const optionId of answer.optionIds ?? []) {
          ballots.push({
            questionId: answer.questionId,
            optionId,
            ballotHash: await generateSurveyBallotHash(
              surveyId,
              answer.questionId,
              optionId,
            ),
          });
        }
        break;

      case SurveyQuestionType.SCALE: {
        const scaleValue = String(answer.scale ?? 0);
        ballots.push({
          questionId: answer.questionId,
          optionId: scaleValue,
          ballotHash: await generateSurveyBallotHash(
            surveyId,
            answer.questionId,
            scaleValue,
          ),
        });
        break;
      }

      case SurveyQuestionType.FREEFORM:
        if (answer.text) {
          ballots.push({
            questionId: answer.questionId,
            text: answer.text,
            ballotHash: await generateSurveyBallotHash(
              surveyId,
              answer.questionId,
              "FREEFORM",
            ),
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
    loading: false,
    error: null,
  });

  const fetchSurveys = useCallback(
    async (filters?: { groupId?: string; isOpen?: boolean }) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const queryParams = new URLSearchParams();
      if (filters?.groupId) queryParams.append("groupId", filters.groupId);
      if (filters?.isOpen !== undefined)
        queryParams.append("isOpen", String(filters.isOpen));

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

  // Mirrors POST /surveys/:id/submit with SubmitSurveyResponseDto
  const submitSurvey = useCallback(
    async (surveyId: string, answers: SurveyAnswer[]) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const ballots = await buildBallots(surveyId, answers);
      const payload: SubmitSurveyPayload = { ballots };

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
          error: response.error,
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
    createSurvey,
    submitSurvey,
    deleteSurvey,
  };
}

export default useSurveys;
