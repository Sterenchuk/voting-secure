"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth/context";
import { useSurveys, SurveyAnswer } from "@/hooks/api/useSurveys";
import { useAudit } from "@/hooks/api/useAudit";
import { useSurveyUpdates } from "@/hooks/useSocket";
import { SurveyQuestionType } from "@/types/survey";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { SurveyAuditStatus } from "@/components/surveys/SurveyAuditStatus";
import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import styles from "./page.module.css";

export default function SurveyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  const { verifyScopedIntegrity } = useAudit();
  const {
    currentSurvey,
    fetchSurvey,
    fetchResults,
    syncResults,
    submitSurvey,
    requestToken,
    getMyStatus,
    fetchParticipationStats,
    loading,
    results,
  } = useSurveys();

  // answers keyed by questionId, typed as SurveyAnswer
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});
  const [showAllOtherForQuestion, setShowAllOtherForQuestion] = useState<
    Record<string, boolean>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isPractice, setIsPractice] = useState(false);
  const [isAbstention, setIsAbstention] = useState(false);
  const [tokenRequested, setTokenRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participationStats, setParticipationStats] = useState<
    Array<{ time: string; votes: number }>
  >([]);
  const [receipts, setReceipts] = useState<string[] | null>(null);

  const isAdminOrAuditor = user?.role === "admin" || user?.role === "auditor";

  // Subscribe to real-time updates
  useSurveyUpdates(id, (data) => {
    syncResults(data);
    if (id) {
      fetchParticipationStats(id).then((res) => {
        if (res.data) setParticipationStats(res.data);
      });
    }
  });

  useEffect(() => {
    if (id) {
      fetchSurvey(id);
      fetchResults(id);
      getMyStatus(id).then((res) => {
        if (res.data?.submitted) {
          setSubmitted(true);
          if (res.data.receipts) setReceipts(res.data.receipts);
        }
      });
      fetchParticipationStats(id).then((res) => {
        if (res.data) setParticipationStats(res.data);
      });
    }
  }, [id, fetchSurvey, fetchResults, getMyStatus, fetchParticipationStats]);

  useEffect(() => {
    if (!tokenRequested || submitted || !id) return;

    const interval = setInterval(async () => {
      const res = await getMyStatus(id);
      if (res.data?.submitted) {
        setSubmitted(true);
        setTokenRequested(false);
        if (res.data.receipts) setReceipts(res.data.receipts);
        clearInterval(interval);
        await fetchSurvey(id);
        await fetchResults(id);
        const statsRes = await fetchParticipationStats(id);
        if (statsRes.data) setParticipationStats(statsRes.data);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [
    tokenRequested,
    submitted,
    id,
    getMyStatus,
    fetchSurvey,
    fetchResults,
    fetchParticipationStats,
  ]);

  if (loading || !currentSurvey) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>{t.common.loading}</p>
      </div>
    );
  }

  const questions = currentSurvey.questions;
  const alreadyParticipated = currentSurvey.hasParticipated || submitted;
  const canSubmit =
    currentSurvey.isOpen && !currentSurvey.isFinalized && !alreadyParticipated;

  const trendData = participationStats
    .map((s) => {
      const d = s.time ? new Date(s.time) : new Date(NaN);
      return {
        time: !isNaN(d.getTime())
          ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "Invalid",
        votes: s.votes,
      };
    })
    .filter((d) => d.time !== "Invalid");

  const toggleShowOther = (questionId: string) => {
    setShowAllOtherForQuestion((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const handleAbstain = () => {
    if (!canSubmit || tokenRequested) return;
    setIsAbstention(!isAbstention);
    setAnswers({});
  };

  const setOptionAnswer = (
    questionId: string,
    optionId: string,
    multiple: boolean,
    type: SurveyQuestionType,
  ) => {
    if (isAbstention) return;
    setAnswers((prev) => {
      const current = prev[questionId]?.optionIds ?? [];
      const isOther = optionId === "OTHER";

      let next: string[];
      let text: string | undefined = prev[questionId]?.text;

      if (isOther) {
        if (multiple) {
          next = current;
          text = text !== undefined ? undefined : "";
        } else {
          next = [];
          text = "";
        }
      } else {
        next = multiple
          ? current.includes(optionId)
            ? current.filter((x) => x !== optionId)
            : [...current, optionId]
          : [optionId];
        if (!multiple) text = undefined;
      }

      return {
        ...prev,
        [questionId]: { questionId, type, optionIds: next, text },
      };
    });
  };

  const setTextAnswer = (
    questionId: string,
    text: string,
    type: SurveyQuestionType = SurveyQuestionType.FREEFORM,
  ) => {
    if (isAbstention) return;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], questionId, type, text },
    }));
  };

  const setScaleAnswer = (questionId: string, scale: number) => {
    if (isAbstention) return;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { questionId, type: SurveyQuestionType.SCALE, scale },
    }));
  };

  const handleSubmit = async () => {
    const unanswered = questions.filter((q) => q.isRequired && !answers[q.id]);
    if (!isAbstention && unanswered.length > 0) {
      setError(t.common.error);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // 1. Request Token
      const currentAnswers = isAbstention ? [] : Object.values(answers);
      const tokenRes = await requestToken(id, currentAnswers, isPractice);
      if (tokenRes.error || !tokenRes.data) {
        throw new Error(
          tokenRes.error?.message || "Failed to get survey token",
        );
      }

      if (isPractice && tokenRes.data.token) {
        // 2. Submit directly for practice
        const submitRes = await submitSurvey(id, currentAnswers, tokenRes.data.token, isPractice);
        if (submitRes.data?.success) {
          setSubmitted(true);
          if (submitRes.data.receipts) setReceipts(submitRes.data.receipts);
        }
      } else {
        setTokenRequested(true);
      }
    } catch (e: any) {
      setError(e?.message ?? t.common.error);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadReceipt = () => {
    if (!receipts) return;
    const data = JSON.stringify(
      {
        surveyId: id,
        surveyTitle: currentSurvey.title,
        submittedAt: new Date().toISOString(),
        receipts: receipts,
        proof: {
          verifyUrl: `/surveys/${id}/verify`,
          chainUrl: `/audit/surveys/audit-chain/${id}`,
        },
      },
      null,
      2,
    );
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `survey-receipt-${id.slice(0, 8)}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const status = currentSurvey.isFinalized
    ? "completed"
    : currentSurvey.isOpen
      ? "active"
      : "draft";

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

  const getQuestionResults = (questionId: string) => {
    if (!results) return null;
    return results.find((r: any) => r.questionId === questionId);
  };

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />

      {isPractice && (
        <div className={styles.sandboxBanner}>
          <div className={styles.sandboxContent}>
            <span className={styles.sandboxBadge}>SANDBOX MODE</span>
            <p className={styles.sandboxText}>
              This is a simulation. No real data will be recorded in the permanent audit chain.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setIsPractice(false)}>
            Exit Practice
          </Button>
        </div>
      )}

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
          <span className={styles.metaItem}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="14"
              height="14"
            >
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            {currentSurvey.responsesCount} {t.votings.votes}
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

      {!isPractice && currentSurvey.isOpen && !alreadyParticipated && (
        <div className={styles.practicePrompt}>
          <p>{t.votings.practiceModeHint || "Want to try before you submit?"}</p>
          <Button variant="secondary" size="sm" onClick={() => setIsPractice(true)}>
            {t.votings.startPractice || "Start Practice Mode"}
          </Button>
        </div>
      )}

      <Card className={styles.contentCard}>
        <SurveyAuditStatus 
          survey={currentSurvey}
          isAdminOrAuditor={isAdminOrAuditor}
          onVerifyChain={() => verifyScopedIntegrity("survey", id)}
        />

        {submitted && (
          <div className={`${styles.receiptSection} ${isPractice ? styles.practiceReceipt : ""}`}>
            <h3 className={styles.receiptTitle}>
              {isPractice ? "✓ Practice Session Completed" : `✓ ${t.surveys.participationConfirmed || "Response Confirmed"}`}
            </h3>
            <p className={styles.receiptText}>
              {isPractice 
                ? "This was a practice run. No real response was recorded." 
                : t.votings.receiptSentEmail || "Your response has been securely recorded."}
            </p>
            {receipts && (
              <div className="flex gap-2 justify-center">
                <Button size="sm" variant="outline" onClick={downloadReceipt}>
                  {isPractice ? "Download Sample Receipt" : t.votings.downloadReceipt || "Download Receipt"}
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => {
                    navigator.clipboard.writeText(receipts.join('\n'));
                  }}
                >
                  Copy All Hashes
                </Button>
              </div>
            )}
          </div>
        )}

        {trendData.length > 0 && (alreadyParticipated || currentSurvey.isFinalized) && (
          <div className={styles.trendChart}>
            <div className={styles.trendHeader}>
              <TrendingUp className={styles.trendIcon} />
              <h3 className={styles.trendTitle}>
                {t.votings.votingTendencies || "Submission Trends"}
              </h3>
            </div>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="votes"
                    stroke="var(--color-accent-primary)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "var(--color-accent-primary)" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className={styles.questionList}>
          {canSubmit && currentSurvey.allowAbstain && (
            <div
              className={`${styles.abstainCard} ${isAbstention ? styles.abstainSelected : ""}`}
              onClick={handleAbstain}
            >
              <div className={styles.optionRow}>
                <div
                  className={`${styles.optionControl} ${isAbstention ? styles.optionControlSelected : ""} ${styles.optionRadio}`}
                >
                  {isAbstention && <div className={styles.radioInner} />}
                </div>
                <div className={styles.abstainInfo}>
                  <p className={styles.abstainTitle}>{t.common.abstain}</p>
                  <p className={styles.abstainText}>
                    I do not wish to answer any questions in this survey.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div style={{ opacity: isAbstention ? 0.4 : 1, pointerEvents: isAbstention ? 'none' : 'auto' }}>
          {questions.map((question, idx) => {
            const isMultiple =
              question.type === SurveyQuestionType.MULTIPLE_CHOICE ||
              question.choiceConfig?.allowMultiple === true;
            const questionResults = getQuestionResults(question.id);
            const totalQuestionVotes = questionResults?.totalVotes || 0;
            const otherCount = questionResults?.otherCount || 0;
            const showResults = (alreadyParticipated || currentSurvey.isFinalized) && !isPractice;

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

                {(question.type === SurveyQuestionType.SINGLE_CHOICE ||
                  question.type === SurveyQuestionType.MULTIPLE_CHOICE) && (
                  <ul className={styles.optionList}>
                    {question.options.map((opt) => {
                      const selected = (
                        answers[question.id]?.optionIds ?? []
                      ).includes(opt.id);
                      const optionResult = questionResults?.options?.find(
                        (o: any) => o.id === opt.id,
                      );
                      const voteCount = optionResult?.count || 0;
                      const pct =
                        totalQuestionVotes > 0
                          ? Math.round((voteCount / totalQuestionVotes) * 100)
                          : 0;

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
                        >
                          <div className={styles.optionRow}>
                            {canSubmit && (
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
                            )}
                            <span className={styles.optionText}>{opt.text}</span>
                            {showResults && (
                              <span className={styles.optionPct}>{pct}%</span>
                            )}
                          </div>
                          {showResults && (
                            <div className={styles.progressBar}>
                              <div
                                className={styles.progressFill}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}

                    {question.choiceConfig?.allowOther && (
                      <>
                        <li
                          className={`${styles.optionItem} ${canSubmit ? styles.optionClickable : ""} ${answers[question.id]?.text !== undefined ? styles.optionSelected : ""}`}
                          onClick={() =>
                            canSubmit &&
                            setOptionAnswer(
                              question.id,
                              "OTHER",
                              isMultiple,
                              question.type,
                            )
                          }
                        >
                          <div className={styles.optionRow}>
                            {canSubmit && (
                              <div
                                className={`${styles.optionControl} ${answers[question.id]?.text !== undefined ? styles.optionControlSelected : ""} ${isMultiple ? styles.optionCheckbox : styles.optionRadio}`}
                              >
                                {answers[question.id]?.text !== undefined &&
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
                            )}

                            <div className={styles.otherInputInline}>
                              <span className={styles.optionText}>
                                {t.common.other}:
                              </span>
                              {canSubmit ? (
                                <input
                                  type="text"
                                  className={styles.inlineInput}
                                  placeholder="___________________"
                                  value={answers[question.id]?.text || ""}
                                  onChange={(e) =>
                                    setTextAnswer(
                                      question.id,
                                      e.target.value,
                                      question.type,
                                    )
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span className={styles.optionText}>
                                  {otherCount} responses
                                </span>
                              )}
                            </div>

                            {showResults && (
                              <span className={styles.optionPct}>
                                {totalQuestionVotes > 0
                                  ? Math.round(
                                      (otherCount / totalQuestionVotes) * 100,
                                    )
                                  : 0}
                                %
                              </span>
                            )}
                          </div>
                          {showResults && (
                            <div className={styles.progressBar}>
                              <div
                                className={styles.progressFill}
                                style={{
                                  width: `${totalQuestionVotes > 0 ? Math.round((otherCount / totalQuestionVotes) * 100) : 0}%`,
                                }}
                              />
                            </div>
                          )}
                        </li>

                        {showResults && otherCount > 0 && (
                          <div
                            style={{
                              marginTop: "var(--space-xs)",
                              padding: "0 var(--space-md)",
                            }}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleShowOther(question.id)}
                            >
                              {showAllOtherForQuestion[question.id]
                                ? "Hide"
                                : "Show"}{" "}
                              Individual Answers
                            </Button>
                            {showAllOtherForQuestion[question.id] && (
                              <div
                                style={{
                                  marginTop: "var(--space-sm)",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "4px",
                                }}
                              >
                                {questionResults?.freeformAnswers?.map(
                                  (a: any, idx: number) => (
                                    <div
                                      key={idx}
                                      style={{
                                        padding: "6px 10px",
                                        backgroundColor:
                                          "var(--color-bg-secondary)",
                                        borderRadius: "4px",
                                        fontSize: "var(--text-xs)",
                                      }}
                                    >
                                      {a.text || a}
                                    </div>
                                  ),
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </ul>
                )}

                {question.type === SurveyQuestionType.FREEFORM && (
                  <>
                    {canSubmit && (
                      <textarea
                        className={styles.textarea}
                        placeholder={t.common.submit}
                        value={answers[question.id]?.text ?? ""}
                        onChange={(e) => setTextAnswer(question.id, e.target.value)}
                        disabled={!canSubmit}
                        rows={4}
                      />
                    )}
                    {showResults && (
                      <div style={{ marginTop: "var(--space-sm)" }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleShowOther(question.id)}
                        >
                          {showAllOtherForQuestion[question.id]
                            ? "Hide"
                            : "Show"}{" "}
                          All Responses
                        </Button>
                        {showAllOtherForQuestion[question.id] && (
                          <div
                            style={{
                              marginTop: "var(--space-sm)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px",
                            }}
                          >
                            {questionResults?.freeformAnswers?.map(
                              (a: any, idx: number) => (
                                <div
                                  key={idx}
                                  style={{
                                    padding: "8px 12px",
                                    backgroundColor: "var(--color-bg-secondary)",
                                    borderRadius: "4px",
                                    fontSize: "var(--text-sm)",
                                    border: "1px solid var(--color-border)",
                                  }}
                                >
                                  {a.text || a}
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {question.type === SurveyQuestionType.SCALE &&
                  question.scaleConfig && (
                    <div className={styles.scaleWrapper}>
                      <div className={styles.scaleLabels}>
                        <span>{question.scaleConfig.scaleMin}</span>
                        <span>{question.scaleConfig.scaleMax}</span>
                      </div>
                      {canSubmit && (
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
                      )}
                      {canSubmit && (
                        <div className={styles.scaleValue}>
                          {answers[question.id]?.scale ??
                            question.scaleConfig.scaleMin}
                        </div>
                      )}
                      {showResults && (
                        <div className={styles.scaleResults}>
                           <p>{t.surveys.totalResponses || "Total Responses"}: {totalQuestionVotes}</p>
                        </div>
                      )}
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
        </div>
      </Card>
    </div>
  );
}
