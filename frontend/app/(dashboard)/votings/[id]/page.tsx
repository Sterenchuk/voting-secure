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
import { VotingDetailHeader } from "@/components/votings/VotingDetailHeader";
import { VotingResults } from "@/components/votings/VotingResults";
import { VotingForm } from "@/components/votings/VotingForm";
import { AuditStatus } from "@/components/votings/AuditStatus";
import styles from "./page.module.css";

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
  const [isPractice, setIsPractice] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tokenRequested, setTokenRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voteReceipt, setVoteReceipt] = useState<CastVoteResponse | null>(null);
  const [participationStats, setParticipationStats] = useState<
    Array<{ time: string; votes: number }>
  >([]);

  const isAdminOrAuditor = user?.role === "admin" || user?.role === "auditor";

  useVotingUpdates(id, (data) => {
    syncResults(data);
    if (id) {
      fetchParticipationStats(id).then((res) => {
        if (res.data) setParticipationStats(res.data);
      });
    }
  });

  useEffect(() => {
    if (id) {
      fetchVoting(id);
      fetchResults(id);
      fetchParticipationStats(id).then((res) => {
        if (res.data) setParticipationStats(res.data);
      });
    }
  }, [id, fetchVoting, fetchResults, fetchParticipationStats]);

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
  }, [
    tokenRequested,
    submitted,
    id,
    fetchVoting,
    fetchResults,
    fetchParticipationStats,
  ]);

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
  const canVote = currentVoting.isOpen && !currentVoting.isFinalized && !alreadyVoted;

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
        isPractice,
      );

      if (tokenRes.error || !tokenRes.data) {
        throw new Error(tokenRes.error?.message || "Failed to request token");
      }

      if (isPractice && tokenRes.data.token) {
        // Direct vote for practice mode
        const res = await api.post<CastVoteResponse>(`/votings/${id}/vote`, {
          token: tokenRes.data.token,
          ballots: selectedOptions.map(opt => ({ optionId: opt })),
          otherText: showOtherInput ? otherText.trim() : undefined,
          isAbstention,
          isPractice: true,
        });

        if (res.data) {
          setSubmitted(true);
          setVoteReceipt(res.data);
        } else {
          throw new Error(res.error?.message || "Practice vote failed");
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
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost/api"}/votings/${id}/results/csv`;
  };

  const downloadEmlResults = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost/api"}/votings/${id}/results/eml`;
  };

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.votings, href: "/votings" },
    { label: currentVoting.title },
  ];

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

      <VotingDetailHeader voting={currentVoting} />

      {!isPractice && currentVoting.isOpen && !alreadyVoted && (
        <div className={styles.practicePrompt}>
          <p>{t.votings.practiceModeHint || "Want to try before you vote?"}</p>
          <Button variant="secondary" size="sm" onClick={() => setIsPractice(true)}>
            {t.votings.startPractice || "Start Practice Mode"}
          </Button>
        </div>
      )}

      <Card className={styles.contentCard}>
        <AuditStatus 
          voting={currentVoting}
          isAdminOrAuditor={isAdminOrAuditor}
          onVerifyChain={() => verifyScopedIntegrity("voting", id)}
          onExportCsv={downloadCsvResults}
          onExportEml={downloadEmlResults}
        />

        {submitted && (
          <div className={`${styles.receiptSection} ${isPractice ? styles.practiceReceipt : ""}`}>
            <h3 className={styles.receiptTitle}>
              {isPractice ? "✓ Practice Session Completed" : `✓ ${t.votings.voteConfirmed}`}
            </h3>
            <p className={styles.receiptText}>
              {isPractice 
                ? "This was a practice run. No real vote was cast." 
                : `📧 ${t.votings.receiptSentEmail}`}
            </p>
            {voteReceipt && (
              <div className="flex gap-2 justify-center">
                <Button size="sm" variant="outline" onClick={downloadReceipt}>
                  {isPractice ? "Download Sample Receipt" : t.votings.downloadReceipt}
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => {
                    navigator.clipboard.writeText(voteReceipt.receipts.join('\n'));
                  }}
                >
                  Copy All Hashes
                </Button>
              </div>
            )}
          </div>
        )}

        <VotingResults 
          voting={currentVoting}
          participationStats={participationStats}
        />

        <VotingForm 
          voting={currentVoting}
          selectedOptions={selectedOptions}
          isAbstention={isAbstention}
          otherText={otherText}
          showOtherInput={showOtherInput}
          tokenRequested={tokenRequested}
          submitting={submitting}
          error={error}
          onToggle={handleToggle}
          onOtherTextChange={(text) => {
            setOtherText(text);
            setIsAbstention(false);
            if (!showOtherInput) {
              if (!isMultiple) setSelectedOptions([]);
              setShowOtherInput(true);
            }
          }}
          onSubmit={handleSubmit}
          onCancelToken={() => setTokenRequested(false)}
        />
      </Card>
    </div>
  );
}
