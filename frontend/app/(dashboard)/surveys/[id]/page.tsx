"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth/context";
import { useSurveys, SurveyAnswer } from "@/hooks/api/useSurveys";
import { useAudit } from "@/hooks/api/useAudit";
import { useSurveyUpdates } from "@/hooks/useSocket";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { SurveyQuestion } from "@/components/surveys/questions";
import { SurveyQuestionType } from "@/types/survey";
import {
  CheckCircle,
  Clock,
  Lock,
  AlertCircle,
  FileCode,
  Table,
  ShieldCheck,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SurveyResults } from "@/components/surveys/SurveyResults";
import { ScheduledComponent } from "@/components/common/ScheduledComponent";
import styles from "./page.module.css";

function CompletedBanner({ endAt }: { endAt: string | null }) {
  const { t } = useI18n();
  return (
    <div className={styles.gateBanner} data-variant="completed">
      <Lock className={styles.gateIcon} />
      <div>
        <p className={styles.gateTitle}>{t.surveys.surveyEnded}</p>
        {endAt && (
          <p className={styles.gateSub}>
            {t.surveys.closedOn} {new Date(endAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

function AlreadyVotedBanner({ receipts }: { receipts?: string[] }) {
  const { t } = useI18n();
  return (
    <div className={styles.gateBanner} data-variant="voted">
      <CheckCircle className={styles.gateIcon} />
      <div>
        <p className={styles.gateTitle}>{t.surveys.alreadySubmitted}</p>
        {receipts && receipts.length > 0 && (
          <p className={styles.gateSub}>
            {t.surveys.yourReceipt}:{" "}
            <span className={styles.receiptHash}>
              {receipts[0].slice(0, 20)}…
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function DraftBanner() {
  const { t } = useI18n();
  return (
    <div className={styles.gateBanner} data-variant="draft">
      <Clock className={styles.gateIcon} />
      <div>
        <p className={styles.gateTitle}>{t.surveys.notOpenYet}</p>
        <p className={styles.gateSub}>{t.surveys.checkBackActive}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SurveyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  const surveyId = params.id as string;

  const {
    currentSurvey: survey,
    results,
    loading,
    fetchSurvey,
    fetchResults,
    syncResults,
    getMyStatus,
    requestToken,
    practiceSubmit,
    finalizeSurvey,
    fetchParticipationStats,
  } = useSurveys();

  const { getAuditStatus, status: auditStatus } = useAudit();

  const [answers, setAnswers] = useState<Map<string, SurveyAnswer>>(new Map());
  const [myStatus, setMyStatus] = useState<{
    submitted: boolean;
    receipts?: string[];
  } | null>(null);
  const [submitStep, setSubmitStep] = useState<
    "idle" | "awaitingToken" | "submitting" | "done" | "error"
  >("idle");
  const [tokenRequested, setTokenRequested] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isAbstaining, setIsAbstaining] = useState(false);
  const [isPractice, setIsPractice] = useState(false);
  const [participationStats, setParticipationStats] = useState<
    Array<{ time: string; votes: number }>
  >([]);

  useSurveyUpdates(surveyId, (data) => {
    if (data.results) {
      syncResults(data.results);
    }
    if (surveyId) {
      fetchParticipationStats(surveyId).then((res) => {
        if (res.data) setParticipationStats(res.data);
      });
    }
  });

  const handleFinalize = async () => {
    if (!surveyId || !user || user.role !== "admin") return;
    if (
      !window.confirm(
        "Are you sure you want to finalize this survey? This will seal the results and make them immutable.",
      )
    )
      return;

    try {
      const res = await finalizeSurvey(surveyId);
      if (res.error) throw new Error(res.error.message);
      await fetchSurvey(surveyId);
    } catch (e: any) {
      setSubmitError(e.message || "Failed to finalize survey");
    }
  };

  const downloadCsvResults = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost/api"}/surveys/${surveyId}/results/csv`;
  };

  const downloadEmlResults = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost/api"}/surveys/${surveyId}/results/eml`;
  };

  useEffect(() => {
    fetchSurvey(surveyId);
    if (surveyId) {
      getAuditStatus("survey", surveyId);
      fetchParticipationStats(surveyId).then((res) => {
        if (res.data) setParticipationStats(res.data);
      });
    }
  }, [fetchSurvey, surveyId, getAuditStatus, fetchParticipationStats]);

  useEffect(() => {
    if (surveyId && (survey?.hasParticipated || submitStep === 'done' || survey?.isFinalized)) {
      fetchResults(surveyId, true);
      fetchParticipationStats(surveyId).then((res) => {
        if (res.data) setParticipationStats(res.data);
      });
    }
  }, [surveyId, survey?.hasParticipated, survey?.isFinalized, submitStep, fetchResults, fetchParticipationStats]);

  useEffect(() => {
    if (!surveyId) return;
    getMyStatus(surveyId).then((res) => {
      if (res.data) setMyStatus(res.data);
    });
  }, [getMyStatus, surveyId]);

  useEffect(() => {
    if (!tokenRequested || submitStep === "done" || !surveyId) return;

    const interval = setInterval(async () => {
      const res = await getMyStatus(surveyId);
      if (res.data?.submitted) {
        setMyStatus(res.data);
        setSubmitStep("done");
        setTokenRequested(false);
        clearInterval(interval);
        await fetchSurvey(surveyId);
        await fetchResults(surveyId, true);
        const statsRes = await fetchParticipationStats(surveyId);
        if (statsRes.data) setParticipationStats(statsRes.data);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [
    tokenRequested,
    submitStep,
    surveyId,
    getMyStatus,
    fetchSurvey,
    fetchResults,
    fetchParticipationStats,
  ]);

  const setAnswer = useCallback((answer: SurveyAnswer) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(answer.questionId, answer);
      return next;
    });
  }, []);

  const currentAnswers = Array.from(answers.values());
  const isSubmitting = submitStep === "submitting";

  // Validate required questions are answered
  const missingRequired =
    survey?.questions.filter((q) => {
      if (!q.isRequired) return false;
      const a = answers.get(q.id);
      if (!a) return true;
      if (
        q.type === SurveyQuestionType.SINGLE_CHOICE &&
        !a.optionIds?.length &&
        !a.text?.trim()
      )
        return true;
      if (
        q.type === SurveyQuestionType.MULTIPLE_CHOICE &&
        !a.optionIds?.length &&
        !a.text?.trim()
      )
        return true;
      if (q.type === SurveyQuestionType.SCALE && a.scale === undefined)
        return true;
      if (q.type === SurveyQuestionType.FREEFORM && !a.text?.trim())
        return true;
      return false;
    }) ?? [];

  // ── Submit: real flow (email token) ──────────────────────────────────────
  const handleRequestToken = async () => {
    setSubmitError(null);
    setIsAbstaining(false);
    setSubmitStep("submitting");
    const res = await requestToken(surveyId, currentAnswers, false, false);
    setSubmitStep("idle");
    if (res.error) {
      setSubmitError(res.error.message ?? t.common.error);
    } else {
      setTokenRequested(true);
    }
  };

  // ── Submit: practice mode (no email) ─────────────────────────────────────
  const handlePracticeSubmit = async () => {
    setSubmitError(null);
    setSubmitStep("submitting");
    const res = await practiceSubmit(surveyId, currentAnswers);
    if (res.error) {
      setSubmitError(res.error.message ?? t.common.error);
      setSubmitStep("idle");
    } else {
      setMyStatus({ submitted: true });
      setSubmitStep("done");
    }
  };

  // ── Abstain ───────────────────────────────────────────────────────────────
  const handleAbstain = async () => {
    setSubmitError(null);
    setIsAbstaining(true);
    setSubmitStep("submitting");
    const res = await requestToken(surveyId, [], true, false);
    setSubmitStep("idle");
    if (res.error) {
      setSubmitError(res.error.message ?? t.common.error);
      setIsAbstaining(false);
    } else {
      setTokenRequested(true);
    }
  };

  // ── Abstain ───────────────────────────────────────────────────────────────

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.surveys, href: "/surveys" },
    { label: survey?.title ?? "Survey" },
  ];

  if (loading && !survey) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <AlertCircle className={styles.notFoundIcon} />
          <h2>Survey not found</h2>
          <Button as="link" href="/surveys" variant="outline">
            Back to Surveys
          </Button>
        </div>
      </div>
    );
  }

  // ── Determine voting eligibility ──────────────────────────────────────────
  const isCompleted = survey.status === "completed";
  const isDraft = survey.status === "draft";
  const isScheduled = survey.startAt && new Date(survey.startAt) > new Date();
  
  const userRole = survey.userGroupRole;
  const isGroupAdmin = userRole === "ADMIN" || userRole === "OWNER";
  const isAdmin = user?.role === "admin" || isGroupAdmin;
  
  const isSecure = auditStatus?.isSecure ?? false;
  const canFinalize = isAdmin && !survey.isFinalized && isCompleted && isSecure;

  const hasParticipated =
    myStatus?.submitted ?? survey.hasParticipated ?? false;
  const canVote = !isCompleted && !isDraft && !hasParticipated && !isScheduled;

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />

      {isPractice && (
        <div className={styles.sandboxBanner}>
          <div className={styles.sandboxContent}>
            <span className={styles.sandboxBadge}>SANDBOX MODE</span>
            <p className={styles.sandboxText}>
              This is a simulation. No real data will be recorded in the
              permanent audit chain.
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsPractice(false)}
          >
            Exit Practice
          </Button>
        </div>
      )}

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{survey.title}</h1>
          {survey.description && (
            <p className={styles.description}>{survey.description}</p>
          )}
        </div>
        <div className={styles.headerActions}>
          {canFinalize && (
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleFinalize}
            >
              Finalize Survey
            </Button>
          )}
          {isAdmin && !survey.isFinalized && !isSecure && auditStatus && (
             <div className="text-[10px] text-orange-500 font-bold bg-orange-50 px-2 py-1 rounded border border-orange-100 flex items-center gap-1">
               <Lock className="w-3 h-3" /> Audit required
             </div>
          )}
          {(survey.isFinalized || isCompleted) && isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadCsvResults}>
                <Table className="w-4 h-4 mr-2" /> {t.surveys.exportCsv}
              </Button>
              <Button variant="outline" size="sm" onClick={downloadEmlResults}>
                <FileCode className="w-4 h-4 mr-2" /> {t.surveys.exportEml}
              </Button>
            </div>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/audit/surveys/audit-chain/${surveyId}`)
              }
            >
              Verify Chain
            </Button>
          )}
          {isAdmin && (
             <button 
                onClick={() => router.push(`/audit/surveys/audit-chain/${surveyId}`)}
                className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <Info size={12} /> View Audit Explorer
              </button>
          )}
          <div className={styles.meta}>
            <span
              className={`${styles.statusBadge} ${styles[`status_${survey.status}`]}`}
            >
              {survey.status}
            </span>
            {survey.endAt && (
              <span className={styles.deadline}>
                <Clock className="w-4 h-4" />
                {isCompleted ? "Ended" : "Closes"}{" "}
                {new Date(survey.endAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {isAdmin && !survey.isFinalized && auditStatus && (
        <Card className="mb-6 p-4 border-dashed bg-slate-50/50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-500" />
                Audit Integrity Status
              </h3>
              <Badge variant={isSecure ? "default" : "destructive"} className={`${isSecure ? "bg-green-600" : ""} text-[10px] h-5`}>
                {isSecure ? "SECURE" : "UNVERIFIED"}
              </Badge>
              <button 
                onClick={() => router.push(`/audit/surveys/audit-chain/${surveyId}`)}
                className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <Info size={12} /> View Audit Explorer
              </button>
            </div>
            {!isSecure && (
              <p className="text-[10px] text-orange-600 flex items-center gap-1 font-medium bg-orange-100/50 px-2 py-1 rounded">
                <AlertCircle className="w-3 h-3" />
                Audit required
              </p>
            )}
          </div>
        </Card>
      )}

      {!isScheduled && !isPractice && canVote && (
        <div className={styles.practicePrompt}>
          <p>Want to try before you submit?</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsPractice(true)}
          >
            Start Practice Mode
          </Button>
        </div>
      )}

      {/* ── Voting gate ── */}
      {isScheduled && <ScheduledComponent startAt={survey.startAt!} />}
      {!isScheduled && isCompleted && <CompletedBanner endAt={survey.endAt} />}
      {!isScheduled && !isCompleted && isDraft && <DraftBanner />}
      {!isScheduled && !isCompleted && !isDraft && hasParticipated && (
        <AlreadyVotedBanner receipts={myStatus?.receipts} />
      )}

      {/* ── Success state after submission or if finalized ── */}
      {(submitStep === "done" || hasParticipated || isCompleted) && (
        <div className="space-y-6">
          {submitStep === "done" && (
            <div className={styles.successBanner}>
              <CheckCircle className={styles.successIcon} />
              <div>
                <p className={styles.successTitle}>Response submitted!</p>
                <p className={styles.successSub}>
                  Thank you for participating. Your response has been recorded.
                </p>
              </div>
            </div>
          )}
          
          <div className="mt-8">
          {results && (
            <SurveyResults
              survey={survey}
              results={results}
              participationStats={participationStats}
            />
          )}
          </div>

        </div>
      )}

      {canVote && submitStep !== "done" && (
        <div className={styles.votingForm}>
          {survey.questions
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((q) => (
              <SurveyQuestion
                key={q.id}
                question={q}
                answer={answers.get(q.id)}
                onChange={setAnswer}
              />
            ))}

          {submitError && <p className={styles.errorMsg}>{submitError}</p>}

          <div className={styles.submitActions}>
            {!tokenRequested ? (
              <>
                <Button
                  onClick={handleRequestToken}
                  disabled={missingRequired.length > 0}
                  loading={isSubmitting}
                >
                  Submit Response
                </Button>

                <Button
                  variant="outline"
                  onClick={handlePracticeSubmit}
                  disabled={missingRequired.length > 0}
                  loading={isSubmitting}
                >
                  Practice Submit
                </Button>

                {survey.allowAbstain && (
                  <Button variant="ghost" onClick={handleAbstain} disabled={isSubmitting}>
                    Abstain
                  </Button>
                )}
              </>
            ) : (
              <div className={styles.emailCheck}>
                <div className={styles.emailCheckHeader}>
                  <div className={styles.spinnerSmall} />
                  <span>📧 Check your email to confirm</span>
                </div>
                <p className={styles.emailCheckText}>
                  We've sent a confirmation link to your email. Please click it to finalize your response.
                </p>
                <div className={styles.emailCheckActions}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRequestToken}
                    disabled={isSubmitting}
                  >
                    Resend Email
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setTokenRequested(false)}>
                    Change Selection
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
