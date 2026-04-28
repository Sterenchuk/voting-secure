"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useSurveys, SurveyAnswer } from "@/hooks/api/useSurveys";
import { SurveyQuestionType } from "@/types/survey";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import styles from "./page.module.css";

export default function SurveyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { currentSurvey, fetchSurvey, submitSurvey, loading } = useSurveys();

  // answers keyed by questionId, typed as SurveyAnswer
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchSurvey(id);
  }, [id, fetchSurvey]);

  if (loading || !currentSurvey) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>{t.common.loading}</p>
      </div>
    );
  }

  const questions = currentSurvey.questions;
  const canSubmit =
    currentSurvey.isOpen && !currentSurvey.isFinalized && !submitted;

  const setOptionAnswer = (
    questionId: string,
    optionId: string,
    multiple: boolean,
    type: SurveyQuestionType,
  ) => {
    setAnswers((prev) => {
      const current = prev[questionId]?.optionIds ?? [];
      const next = multiple
        ? current.includes(optionId)
          ? current.filter((x) => x !== optionId)
          : [...current, optionId]
        : [optionId];
      return { ...prev, [questionId]: { questionId, type, optionIds: next } };
    });
  };

  const setTextAnswer = (questionId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { questionId, type: SurveyQuestionType.FREEFORM, text },
    }));
  };

  const setScaleAnswer = (questionId: string, scale: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { questionId, type: SurveyQuestionType.SCALE, scale },
    }));
  };

  const handleSubmit = async () => {
    const unanswered = questions.filter((q) => q.isRequired && !answers[q.id]);
    if (unanswered.length > 0) {
      setError(t.common.error);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitSurvey(id, Object.values(answers));
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.message ?? t.common.error);
    } finally {
      setSubmitting(false);
    }
  };

  const status = currentSurvey.isFinalized
    ? "completed"
    : currentSurvey.isOpen
      ? "active"
      : "draft";

  // Available survey status keys: filterActive, filterDraft, filterCompleted
  const statusLabel: Record<string, string> = {
    active: t.surveys.filterActive,
    draft: t.surveys.filterDraft,
    completed: t.surveys.filterCompleted,
  };

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.surveys, href: "/surveys" },
    { label: currentSurvey.title },
  ];

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />

      {/* Header */}
      <div className={styles.header}>
        <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
          {statusLabel[status]}
        </span>
        <h1 className={styles.title}>{currentSurvey.title}</h1>
        {currentSurvey.description && (
          <p className={styles.description}>{currentSurvey.description}</p>
        )}
        <div className={styles.meta}>
          <span className={styles.metaItem}>
            {questions.length} {t.surveys.questions}
          </span>
          {currentSurvey.endAt && (
            <span className={styles.metaItem}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="14"
                height="14"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {t.surveys.deadline}:{" "}
              {new Date(currentSurvey.endAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {submitted ? (
        <Card className={styles.successCard}>
          <div className={styles.successIcon}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="32"
              height="32"
            >
              <path d="M9 12l2 2 4-4" />
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2>{t.common.submit}</h2>
          <p>{t.surveys.viewResults}</p>
        </Card>
      ) : (
        <>
          <div className={styles.questionList}>
            {questions.map((question, idx) => {
              const isMultiple =
                question.type === SurveyQuestionType.MULTIPLE_CHOICE ||
                question.choiceConfig?.allowMultiple === true;

              return (
                <Card key={question.id} className={styles.questionCard}>
                  <div className={styles.questionHeader}>
                    <span className={styles.questionNumber}>{idx + 1}</span>
                    <div className={styles.questionMeta}>
                      <p className={styles.questionText}>
                        {question.text}
                        {question.isRequired && (
                          <span className={styles.required}>*</span>
                        )}
                      </p>
                      <span className={styles.questionType}>
                        {question.type.toLowerCase().replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  {/* Single / Multiple choice */}
                  {(question.type === SurveyQuestionType.SINGLE_CHOICE ||
                    question.type === SurveyQuestionType.MULTIPLE_CHOICE) && (
                    <ul className={styles.optionList}>
                      {question.options.map((opt) => {
                        const selected = (
                          answers[question.id]?.optionIds ?? []
                        ).includes(opt.id);
                        return (
                          <li
                            key={opt.id}
                            className={`${styles.optionItem} ${canSubmit ? styles.optionClickable : ""} ${selected ? styles.optionSelected : ""}`}
                            onClick={() =>
                              canSubmit &&
                              setOptionAnswer(
                                question.id,
                                opt.id,
                                isMultiple,
                                question.type,
                              )
                            }
                            role={canSubmit ? "button" : undefined}
                            tabIndex={canSubmit ? 0 : undefined}
                            onKeyDown={(e) =>
                              e.key === "Enter" &&
                              canSubmit &&
                              setOptionAnswer(
                                question.id,
                                opt.id,
                                isMultiple,
                                question.type,
                              )
                            }
                          >
                            <div
                              className={`${styles.optionControl} ${selected ? styles.optionControlSelected : ""} ${isMultiple ? styles.optionCheckbox : styles.optionRadio}`}
                            >
                              {selected &&
                                (isMultiple ? (
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3"
                                    width="10"
                                    height="10"
                                  >
                                    <path d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <div className={styles.radioInner} />
                                ))}
                            </div>
                            <span className={styles.optionText}>
                              {opt.text}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {/* Freeform — was "TEXT" which doesn't exist in SurveyQuestionType */}
                  {question.type === SurveyQuestionType.FREEFORM && (
                    <textarea
                      className={styles.textarea}
                      placeholder={t.common.submit}
                      value={answers[question.id]?.text ?? ""}
                      onChange={(e) =>
                        setTextAnswer(question.id, e.target.value)
                      }
                      disabled={!canSubmit}
                      rows={4}
                    />
                  )}

                  {/* Scale */}
                  {question.type === SurveyQuestionType.SCALE &&
                    question.scaleConfig && (
                      <div className={styles.scaleWrapper}>
                        <div className={styles.scaleLabels}>
                          <span>{question.scaleConfig.scaleMin}</span>
                          <span>{question.scaleConfig.scaleMax}</span>
                        </div>
                        <input
                          type="range"
                          className={styles.scaleInput}
                          min={question.scaleConfig.scaleMin}
                          max={question.scaleConfig.scaleMax}
                          step={question.scaleConfig.step}
                          value={
                            answers[question.id]?.scale ??
                            question.scaleConfig.scaleMin
                          }
                          onChange={(e) =>
                            setScaleAnswer(question.id, Number(e.target.value))
                          }
                          disabled={!canSubmit}
                        />
                        <div className={styles.scaleValue}>
                          {answers[question.id]?.scale ??
                            question.scaleConfig.scaleMin}
                        </div>
                      </div>
                    )}
                </Card>
              );
            })}
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          {canSubmit && (
            <div className={styles.submitRow}>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                loading={submitting}
                size="lg"
              >
                {t.common.submit}
              </Button>
            </div>
          )}

          {!canSubmit && !submitted && (
            <div className={styles.closedMsg}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="18"
                height="18"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              {t.surveys.noSurveysDescription}
            </div>
          )}
        </>
      )}
    </div>
  );
}
