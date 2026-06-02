"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth/context";
import { useSurveys, SurveyAnswer } from "@/hooks/api/useSurveys";
import { useAudit } from "@/hooks/api/useAudit";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import styles from "./page.module.css";

function CompletedBanner({ endAt }: { endAt: string | null }) {
  return (
    <div className={styles.gateBanner} data-variant="completed">
      <Lock className={styles.gateIcon} />
      <div>
        <p className={styles.gateTitle}>This survey has ended</p>
        {endAt && (
          <p className={styles.gateSub}>
            Closed on {new Date(endAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

function AlreadyVotedBanner({ receipts }: { receipts?: string[] }) {
  return (
    <div className={styles.gateBanner} data-variant="voted">
      <CheckCircle className={styles.gateIcon} />
      <div>
        <p className={styles.gateTitle}>
          You have already submitted a response
        </p>
        {receipts && receipts.length > 0 && (
          <p className={styles.gateSub}>
            Your receipt:{" "}
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
  return (
    <div className={styles.gateBanner} data-variant="draft">
      <Clock className={styles.gateIcon} />
      <div>
        <p className={styles.gateTitle}>This survey is not open yet</p>
        <p className={styles.gateSub}>
          Check back when the survey becomes active.
        </p>
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
    loading,
    fetchSurvey,
    getMyStatus,
    requestToken,
    submitSurvey,
    practiceSubmit,
    finalizeSurvey,
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [emailToken, setEmailToken] = useState("");
  const [isAbstaining, setIsAbstaining] = useState(false);

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
    if (surveyId) getAuditStatus("survey", surveyId);
  }, [fetchSurvey, surveyId, getAuditStatus]);

  useEffect(() => {
    if (!surveyId) return;
    getMyStatus(surveyId).then((res) => {
      if (res.data) setMyStatus(res.data);
    });
  }, [getMyStatus, surveyId]);

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
        !a.text
      )
        return true;
      if (
        q.type === SurveyQuestionType.MULTIPLE_CHOICE &&
        !a.optionIds?.length &&
        !a.text
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
    const res = await requestToken(surveyId, currentAnswers, false, false);
    if (res.error) {
      setSubmitError(res.error.message ?? t.common.error);
    } else {
      setSubmitStep("awaitingToken");
    }
  };

  const handleConfirmWithToken = async () => {
    setSubmitError(null);
    setSubmitStep("submitting");
    const res = await submitSurvey(
      surveyId,
      isAbstaining ? [] : currentAnswers,
      emailToken.trim(),
      isAbstaining,
      false,
    );
    if (res.error) {
      setSubmitError(res.error.message ?? t.common.error);
      setSubmitStep("awaitingToken");
    } else {
      setMyStatus({ submitted: true });
      setSubmitStep("done");
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
    const res = await requestToken(surveyId, [], true, false);
    if (res.error) {
      setSubmitError(res.error.message ?? t.common.error);
      setIsAbstaining(false);
    } else {
      setSubmitStep("awaitingToken");
    }
  };

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
  
  const userRole = survey.userGroupRole;
  const isGroupAdmin = userRole === "ADMIN" || userRole === "OWNER";
  const isAdmin = user?.role === "admin" || isGroupAdmin;
  
  const isSecure = auditStatus?.isSecure ?? false;
  const canFinalize = isAdmin && !survey.isFinalized && isCompleted && isSecure;

  const hasParticipated =
    myStatus?.submitted ?? survey.hasParticipated ?? false;
  const canVote = !isCompleted && !isDraft && !hasParticipated;

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />

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
          {survey.isFinalized && isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadCsvResults}>
                <Table className="w-4 h-4 mr-2" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={downloadEmlResults}>
                <FileCode className="w-4 h-4 mr-2" /> Export EML
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
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              Audit Integrity Status
            </h3>
            <Badge variant={isSecure ? "default" : "destructive"} className={isSecure ? "bg-green-600" : ""}>
              {isSecure ? "SECURE" : "UNVERIFIED"}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="block text-muted-foreground mb-1 uppercase tracking-wider font-semibold" style={{ fontSize: '10px' }}>Last Full Scan</span>
              <span className="font-mono font-medium text-slate-700">
                {auditStatus.lastFullVerificationAt 
                  ? new Date(auditStatus.lastFullVerificationAt).toLocaleString() 
                  : "Never (Scan required)"}
              </span>
            </div>
            <div>
              <span className="block text-muted-foreground mb-1 uppercase tracking-wider font-semibold" style={{ fontSize: '10px' }}>Verified Sequence</span>
              <span className="font-mono font-medium text-slate-700">Block #{auditStatus.lastVerifiedSequence}</span>
            </div>
          </div>
          {!isSecure && (
            <p className="mt-3 text-[11px] text-orange-600 flex items-center gap-1 font-medium bg-orange-100/50 p-2 rounded">
              <AlertCircle className="w-3 h-3" />
              {auditStatus.reason || "A full audit scan is required before finalization can be performed."}
            </p>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-4 w-full bg-white border-slate-200 hover:bg-slate-50 text-slate-600 font-bold"
            onClick={() => router.push(`/audit/surveys/audit-chain/${surveyId}`)}
          >
            Open Audit Explorer
          </Button>
        </Card>
      )}

      {/* ── Voting gate ── */}
      {isCompleted && <CompletedBanner endAt={survey.endAt} />}
      {!isCompleted && isDraft && <DraftBanner />}
      {!isCompleted && !isDraft && hasParticipated && (
        <AlreadyVotedBanner receipts={myStatus?.receipts} />
      )}

      {/* ── Success state after submission ── */}
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

          {/* Token confirmation step */}
          {submitStep === "awaitingToken" && (
            <Card className={styles.tokenCard}>
              <p className={styles.tokenInfo}>
                A confirmation link has been sent to your email. Enter the token
                from the email below to confirm your submission.
              </p>
              <input
                className={styles.tokenInput}
                placeholder="Paste your token here…"
                value={emailToken}
                onChange={(e) => setEmailToken(e.target.value)}
              />
              <div className={styles.tokenActions}>
                <Button
                  onClick={handleConfirmWithToken}
                  disabled={!emailToken.trim()}
                  loading={isSubmitting}
                >
                  Confirm Submission
                </Button>
                <Button variant="ghost" onClick={() => setSubmitStep("idle")}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {submitStep === "idle" && (
            <div className={styles.submitActions}>
              <Button
                onClick={handleRequestToken}
                disabled={missingRequired.length > 0}
              >
                Submit Response
              </Button>

              <Button
                variant="outline"
                onClick={handlePracticeSubmit}
                disabled={missingRequired.length > 0}
              >
                Practice Submit
              </Button>

              {survey.allowAbstain && (
                <Button variant="ghost" onClick={handleAbstain}>
                  Abstain
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
