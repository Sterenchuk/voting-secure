"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth/context";
import { useVotings, CastVoteResponse } from "@/hooks/api/useVotings";
import { useAudit } from "@/hooks/api/useAudit";
import { useVotingUpdates } from "@/hooks/useSocket";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { VotingType } from "@/types/voting";
import { api } from "@/hooks/api/useApi";
import { OtherOptionRow } from "@/components/votings/OtherOptionRow";
import styles from "./page.module.css";
import { ShieldCheck, Lock, ExternalLink, FileDown, TrendingUp, Table, FileCode } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function VotingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useAuth();
  const { verifyScopedIntegrity } = useAudit();
  const {
    currentVoting,
    fetchVoting,
    fetchResults,
    syncResults,
    requestToken,
    fetchParticipationStats,
    loading,
  } = useVotings();

  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isAbstention, setIsAbstention] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tokenRequested, setTokenRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voteReceipt, setVoteReceipt] = useState<CastVoteResponse | null>(null);
  const [participationStats, setParticipationStats] = useState<Array<{ time: string; votes: number }>>([]);

  const isAdminOrAuditor = user?.role === "admin" || user?.role === "auditor";

  // Subscribe to real-time updates
  useVotingUpdates(id, (data) => {
    syncResults(data);
    if (id) {
      fetchParticipationStats(id).then(res => {
        if (res.data) setParticipationStats(res.data);
      });
    }
  });

  useEffect(() => {
    if (id) {
      fetchVoting(id);
      fetchResults(id);
      fetchParticipationStats(id).then(res => {
        if (res.data) setParticipationStats(res.data);
      });
    }
  }, [id, fetchVoting, fetchResults, fetchParticipationStats]);

  // Poll for completion
  useEffect(() => {
    if (!tokenRequested || submitted || !id) return;

    const interval = setInterval(async () => {
      const res = await api.get<{ participated: boolean; receipts?: string[] }>(
        `/votings/${id}/my-vote`,
      );
      if (res.data?.participated) {
        setSubmitted(true);
        setTokenRequested(false);
        if (res.data.receipts) {
          setVoteReceipt({
            participated: true,
            receipts: res.data.receipts,
            emailSent: false,
            proof: {
              verifyUrl: `/votings/${id}/verify-receipt`,
              chainUrl: `/audit/votings/audit-chain/${id}`,
            },
          });
        }
        clearInterval(interval);
        await fetchVoting(id);
        await fetchResults(id);
        const statsRes = await fetchParticipationStats(id);
        if (statsRes.data) setParticipationStats(statsRes.data);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [tokenRequested, submitted, id, fetchVoting, fetchResults, fetchParticipationStats]);

  if (loading || !currentVoting) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>{t.common.loading}</p>
      </div>
    );
  }

  const isMultiple = currentVoting.type === VotingType.MULTIPLE_CHOICE;
  const alreadyVoted = currentVoting.hasVoted || submitted;
  const canVote =
    currentVoting.isOpen && !currentVoting.isFinalized && !alreadyVoted;
  const isFinalized = currentVoting.isFinalized;
  const options = currentVoting.options;
  const totalVotes = currentVoting.totalVotes;
  const participantsCount = currentVoting.participantsCount;

  const handleToggle = (optionId: string | "OTHER" | "ABSTAIN") => {
    if (!canVote || tokenRequested) return;

    if (optionId === "ABSTAIN") {
      setIsAbstention(!isAbstention);
      setSelectedOptions([]);
      setShowOtherInput(false);
      setOtherText("");
      return;
    }

    if (optionId === "OTHER") {
      setIsAbstention(false);
      setShowOtherInput(!showOtherInput);
      if (!isMultiple && !showOtherInput) {
        setSelectedOptions([]);
      }
      return;
    }

    setIsAbstention(false);
    if (isMultiple) {
      setSelectedOptions((prev) =>
        prev.includes(optionId as string)
          ? prev.filter((x) => x !== optionId)
          : [...prev, optionId as string],
      );
    } else {
      setSelectedOptions([optionId as string]);
      setShowOtherInput(false);
    }
  };

  const handleSubmit = async () => {
    if (
      !isAbstention &&
      selectedOptions.length === 0 &&
      (!showOtherInput || !otherText.trim())
    )
      return;

    setSubmitting(true);
    setError(null);

    try {
      const tokenRes = await requestToken(
        id,
        selectedOptions,
        showOtherInput ? otherText.trim() : undefined,
        isAbstention,
      );

      if (tokenRes.error || !tokenRes.data) {
        throw new Error(tokenRes.error?.message || "Failed to request token");
      }

      setTokenRequested(true);
    } catch (e: any) {
      setError(e?.message ?? t.common.error);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadReceipt = () => {
    if (!voteReceipt) return;
    const data = JSON.stringify(
      {
        votingId: id,
        votingTitle: currentVoting.title,
        votedAt: new Date().toISOString(),
        receipts: voteReceipt.receipts,
        proof: voteReceipt.proof,
        instructions: {
          verify: `Go to ${voteReceipt.proof.verifyUrl}?hash=receipt`,
          chain: `Full audit chain at ${voteReceipt.proof.chainUrl}`,
        },
      },
      null,
      2,
    );
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vote-receipt-${id.slice(0, 8)}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsvResults = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost/api'}/votings/${id}/results/csv`;
  };

  const downloadEmlResults = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost/api'}/votings/${id}/results/eml`;
  };

  const status = currentVoting.status;
  const statusLabel: Record<string, string> = {
    active: t.votings.filterActive,
    upcoming: t.votings.filterScheduled,
    completed: t.votings.filterCompleted,
    draft: t.votings.filterScheduled,
  };

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.votings, href: "/votings" },
    { label: currentVoting.title },
  ];

  const trendData = participationStats.map(s => {
    const d = s.time ? new Date(s.time) : new Date(NaN);
    return {
      time: !isNaN(d.getTime()) ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Invalid',
      votes: s.votes
    };
  }).filter(d => d.time !== 'Invalid');

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.badges}>
            <span
              className={`${styles.statusBadge} ${styles[`status_${status}`]}`}
            >
              {statusLabel[status]}
            </span>
            <span className={styles.typeBadge}>
              {isMultiple ? t.votings.filterAll : t.common.voting}
            </span>
          </div>
          <h1 className={styles.title}>{currentVoting.title}</h1>
          {currentVoting.description && (
            <p className={styles.description}>{currentVoting.description}</p>
          )}
          <div className={styles.meta}>
            {currentVoting.startAt && !isNaN(new Date(currentVoting.startAt).getTime()) && (
              <span className={styles.metaItem}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="14"
                  height="14"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {new Date(currentVoting.startAt).toLocaleDateString()}
                {currentVoting.endAt && !isNaN(new Date(currentVoting.endAt).getTime()) && (
                  <> – {new Date(currentVoting.endAt).toLocaleDateString()}</>
                )}
              </span>
            )}
            <span className={styles.metaItem}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="14"
                height="14"
              >
                <path d="M9 12l2 2 4-4" />
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {participantsCount} {t.votings.votes}
            </span>
            <a
              href={`/audit/votings/audit-chain/${id}`}
              className={styles.metaItem}
              style={{
                color: "var(--color-primary)",
                textDecoration: "underline",
                fontWeight: 500,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="14"
                height="14"
              >
                <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
              </svg>
              View Audit Chain
            </a>
          </div>
        </div>
      </div>

      <Card className={styles.optionsCard}>
        {alreadyVoted && (
          <div className="mb-6 p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
              <div>
                <h3 className="font-semibold text-emerald-900">
                  Participation Confirmed
                </h3>
                <p className="text-sm text-emerald-700">
                  Your vote is securely recorded on the audit chain.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/audit/verify?votingId=${id}`)}
              >
                Verify My Vote
              </Button>
            </div>
          </div>
        )}

        {isAdminOrAuditor && (
          <div className="mb-6 p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="h-6 w-6 text-slate-600" />
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Audit Administrative
                  </h3>
                  <p className="text-sm text-slate-700">
                    Verify full integrity of this voting chain.
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => verifyScopedIntegrity("voting", id)}
              >
                Verify Voting Chain
              </Button>
            </div>
            {(isFinalized || alreadyVoted) && (
              <div className="flex gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadCsvResults}
                  className="flex items-center gap-2"
                >
                  <Table className="h-4 w-4" /> Export CSV Table
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadEmlResults}
                  className="flex items-center gap-2"
                >
                  <FileCode className="h-4 w-4" /> Export XML Report (EML 510)
                </Button>
              </div>
            )}
          </div>
        )}

        <h2 className={styles.sectionTitle}>
          {isFinalized || alreadyVoted
            ? t.votings.viewResults
            : t.votings.castVote}
        </h2>

        {(isFinalized || alreadyVoted) && trendData.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 text-slate-600">
              <TrendingUp className="h-5 w-5" />
              <h3 className="font-semibold">Voting Tendencies (Activity over Time)</h3>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="votes"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#3b82f6' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {isMultiple && canVote && currentVoting.minChoices > 1 && (
          <p className={styles.hint}>
            {t.votings.votes}: {currentVoting.minChoices}
            {currentVoting.maxChoices ? ` – ${currentVoting.maxChoices}` : "+"}
          </p>
        )}
        {submitted && (
          <div
            className={styles.receiptSection}
            style={{
              marginBottom: "var(--space-xl)",
              padding: "var(--space-lg)",
              backgroundColor: "var(--color-bg-secondary)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-success)",
              textAlign: "center",
            }}
          >
            <h3
              style={{
                margin: 0,
                color: "var(--color-success)",
                fontSize: "var(--text-lg)",
                marginBottom: "var(--space-sm)",
              }}
            >
              ✓ Vote Confirmed
            </h3>
            <p
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-text-muted)",
                marginBottom: voteReceipt ? "var(--space-md)" : 0,
              }}
            >
              📧 Your digital receipt has been sent to your email.
            </p>
            {voteReceipt && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: "var(--space-md)",
                }}
              >
                <Button size="sm" variant="outline" onClick={downloadReceipt}>
                  Download Receipt
                </Button>
              </div>
            )}
          </div>
        )}

        <ul className={styles.optionList}>
          {options.map((option) => {
            const pct =
              totalVotes > 0
                ? Math.round((option.voteCount / totalVotes) * 100)
                : 0;
            const isSelected = selectedOptions.includes(option.id);
            const showResults = isFinalized || alreadyVoted || !canVote;
            return (
              <li
                key={option.id}
                className={`${styles.optionItem} ${canVote && !tokenRequested ? styles.optionClickable : ""} ${isSelected ? styles.optionSelected : ""}`}
                onClick={() => handleToggle(option.id)}
              >
                <div className={styles.optionRow}>
                  {canVote && (
                    <div
                      className={`${styles.optionControl} ${isSelected ? styles.optionControlSelected : ""}`}
                    >
                      {isMultiple
                        ? isSelected && (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              width="12"
                              height="12"
                            >
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          )
                        : isSelected && <div className={styles.radioInner} />}
                    </div>
                  )}
                  <span className={styles.optionText}>{option.text}</span>
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

          {currentVoting.allowOther && canVote && (
            <li
              className={`${styles.optionItem} ${canVote && !tokenRequested ? styles.optionClickable : ""} ${showOtherInput ? styles.optionSelected : ""}`}
              onClick={() => handleToggle("OTHER")}
            >
              <div className={styles.optionRow}>
                <div
                  className={`${styles.optionControl} ${showOtherInput ? styles.optionControlSelected : ""}`}
                >
                  {isMultiple
                    ? showOtherInput && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          width="12"
                          height="12"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )
                    : showOtherInput && <div className={styles.radioInner} />}
                </div>
                <div className={styles.otherInputInline}>
                  <span className={styles.optionText}>{t.common.other}:</span>
                  <input
                    type="text"
                    className={styles.inlineInput}
                    placeholder="___________________"
                    value={otherText}
                    disabled={tokenRequested}
                    onChange={(e) => {
                      setOtherText(e.target.value);
                      setIsAbstention(false);
                      if (!showOtherInput) {
                        if (!isMultiple) setSelectedOptions([]);
                        setShowOtherInput(true);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </li>
          )}

          {currentVoting.allowOther &&
            (isFinalized || alreadyVoted || !canVote) &&
            currentVoting.otherTotal !== undefined && (
              <OtherOptionRow
                otherTotal={currentVoting.otherTotal}
                totalVotes={totalVotes}
                dynamicOptions={currentVoting.dynamicOptions ?? []}
                showResults={true}
              />
            )}

          {canVote && (
            <li
              className={`${styles.optionItem} ${canVote && !tokenRequested ? styles.optionClickable : ""} ${isAbstention ? styles.optionSelected : ""}`}
              onClick={() => handleToggle("ABSTAIN")}
            >
              <div className={styles.optionRow}>
                <div
                  className={`${styles.optionControl} ${isAbstention ? styles.optionControlSelected : ""}`}
                >
                  {isAbstention && <div className={styles.radioInner} />}
                </div>
                <span className={styles.optionText}>{"Abstain"}</span>
              </div>
            </li>
          )}

          {(isFinalized || alreadyVoted || !canVote) && (
            <li className={styles.optionItem}>
              <div className={styles.optionRow}>
                <span className={styles.optionText}>Abstentions</span>
                <span className={styles.optionPct}>
                  {currentVoting.abstentionsCount}
                </span>
              </div>
            </li>
          )}
        </ul>

        {error && <p className={styles.errorMsg}>{error}</p>}

        {canVote && (
          <div className={styles.submitRow}>
            {!tokenRequested ? (
              <Button
                onClick={handleSubmit}
                disabled={
                  (!isAbstention &&
                    selectedOptions.length === 0 &&
                    (!showOtherInput || !otherText.trim())) ||
                  submitting
                }
                loading={submitting}
              >
                {t.votings.castVote}
              </Button>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  width: "100%",
                  padding: "var(--space-md)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "var(--space-sm)",
                    marginBottom: "var(--space-sm)",
                    fontWeight: 500,
                  }}
                >
                  <div
                    className={styles.spinner}
                    style={{ width: 16, height: 16, borderWidth: 2 }}
                  />
                  <span>📧 Check your email to confirm</span>
                </div>
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-muted)",
                    marginBottom: "var(--space-md)",
                  }}
                >
                  We've sent a link to your email. Click it to cast your vote.
                  This page will update automatically.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-sm)",
                    justifyContent: "center",
                  }}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSubmit}
                    disabled={submitting}
                  >
                    Resend email
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setTokenRequested(false)}
                  >
                    Change selection
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
