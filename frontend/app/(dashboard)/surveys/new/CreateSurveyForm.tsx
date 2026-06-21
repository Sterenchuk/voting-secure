"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useSurveys, CreateSurveyData } from "@/hooks/api/useSurveys";
import { useGroups } from "@/hooks/api/useGroups";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { SurveyQuestionType } from "@/types/survey";
import { SurveyBasicInfo } from "@/components/surveys/SurveyBasicInfo";
import { SurveyQuestionsEditor } from "@/components/surveys/SurveyQuestionsEditor";
import { SurveySettings } from "@/components/surveys/SurveySettings";
import { SurveyScheduling } from "@/components/surveys/SurveyScheduling";
import styles from "./CreateSurveyForm.module.css";

interface QuestionDraft {
  type: SurveyQuestionType;
  text: string;
  isRequired: boolean;
  options: string[];
  choiceConfig: {
    allowMultiple: boolean;
    allowOther: boolean;
    minChoices?: number;
    maxChoices?: number;
  };
  scaleConfig: { scaleMin: number; scaleMax: number; step: number };
}

const defaultQuestion = (): QuestionDraft => ({
  type: SurveyQuestionType.SINGLE_CHOICE,
  text: "",
  isRequired: true,
  options: ["", ""],
  choiceConfig: {
    allowMultiple: false,
    allowOther: false,
    minChoices: 1,
    maxChoices: 1,
  },
  scaleConfig: { scaleMin: 1, scaleMax: 5, step: 1 },
});

export default function CreateSurveyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { createSurvey } = useSurveys();
  const { groups, fetchGroups } = useGroups();

  const prefilledGroupId = searchParams.get("groupId") ?? "";

  const [form, setForm] = useState({
    title: "",
    description: "",
    groupId: prefilledGroupId,
    isPublic: true,
    allowAbstain: true,
    startAt: "",
    endAt: "",
  });

  const [questions, setQuestions] = useState<QuestionDraft[]>([
    defaultQuestion(),
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const setField = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /* ── Question helpers ── */
  const addQuestion = () =>
    setQuestions((prev) => [...prev, defaultQuestion()]);

  const removeQuestion = (idx: number) =>
    setQuestions((prev) => prev.filter((_, i) => i !== idx));

  const updateQuestion = (idx: number, fields: Partial<QuestionDraft>) =>
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...fields } : q)),
    );

  const setOption = (qIdx: number, oIdx: number, value: string) =>
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const next = [...q.options];
        next[oIdx] = value;
        return { ...q, options: next };
      }),
    );

  const addOption = (qIdx: number) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx ? { ...q, options: [...q.options, ""] } : q,
      ),
    );

  const removeOption = (qIdx: number, oIdx: number) =>
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, options: q.options.filter((_, oi) => oi !== oIdx) }
          : q,
      ),
    );

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError(t.votings.titleRequired);
      return;
    }
    if (!form.groupId) {
      setError(t.votings.groupRequired);
      return;
    }
    if (questions.length === 0) {
      setError("At least one question is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const data: CreateSurveyData = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      groupId: form.groupId,
      isPublic: form.isPublic,
      allowAbstain: form.allowAbstain,
      startAt: form.startAt || undefined,
      endAt: form.endAt || undefined,
      questions: questions.map((q, idx) => ({
        type: q.type,
        text: q.text,
        isRequired: q.isRequired,
        order: idx,
        options:
          q.type === SurveyQuestionType.SINGLE_CHOICE ||
          q.type === SurveyQuestionType.MULTIPLE_CHOICE
            ? q.options
                .filter((o) => o.trim() !== "")
                .map((o, oIdx) => ({ text: o.trim(), order: oIdx }))
            : undefined,
        choiceConfig:
          q.type === SurveyQuestionType.SINGLE_CHOICE ||
          q.type === SurveyQuestionType.MULTIPLE_CHOICE
            ? {
                allowMultiple: q.choiceConfig.allowMultiple,
                allowOther: q.choiceConfig.allowOther,
                minChoices: q.choiceConfig.minChoices,
                maxChoices: q.choiceConfig.maxChoices,
              }
            : undefined,
        scaleConfig:
          q.type === SurveyQuestionType.SCALE
            ? {
                scaleMin: q.scaleConfig.scaleMin,
                scaleMax: q.scaleConfig.scaleMax,
                step: q.scaleConfig.step,
              }
            : undefined,
      })),
    };

    try {
      const response = await createSurvey(data);
      if (response.data) {
        router.push(`/surveys/${response.data.id}`);
      } else {
        setError(response.error?.message ?? t.common.error);
      }
    } catch (e: any) {
      setError(e?.message ?? t.common.error);
    } finally {
      setSubmitting(false);
    }
  };

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.surveys, href: "/surveys" },
    { label: "Create Survey" },
  ];

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />

      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Create New Survey</h1>
          <p className={styles.subtitle}>
            Design your survey questions and configure settings.
          </p>
        </div>
      </div>

      <div className={styles.formLayout}>
        {/* ── Main column ── */}
        <div className={styles.formMain}>
          <SurveyBasicInfo
            title={form.title}
            description={form.description}
            groupId={form.groupId}
            groups={groups}
            onChange={setField}
          />

          <SurveyQuestionsEditor
            questions={questions}
            onAddQuestion={addQuestion}
            onRemoveQuestion={removeQuestion}
            onUpdateQuestion={updateQuestion}
            onSetOption={setOption}
            onAddOption={addOption}
            onRemoveOption={removeOption}
          />
        </div>

        {/* ── Sidebar ── */}
        <div className={styles.formSidebar}>
          <SurveySettings
            isPublic={form.isPublic}
            allowAbstain={form.allowAbstain}
            onChange={setField}
          />

          <SurveyScheduling
            startAt={form.startAt}
            endAt={form.endAt}
            onChange={setField}
          />

          {error && <p className={styles.errorMsg}>{error}</p>}

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            loading={submitting}
            className={styles.submitBtn}
          >
            {submitting ? "Creating..." : "Create Survey"}
          </Button>

          <Button
            variant="secondary"
            as="link"
            href="/surveys"
            className={styles.cancelBtn}
          >
            {t.common.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
