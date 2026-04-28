"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useVotings } from "@/hooks/api/useVotings";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { VotingType } from "@/types/voting";
import styles from "./page.module.css";

export default function VotingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { currentVoting, fetchVoting, castVote, loading } = useVotings();

  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchVoting(id);
  }, [id, fetchVoting]);

  if (loading || !currentVoting) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>{t.common.loading}</p>
      </div>
    );
  }

  const isMultiple = currentVoting.type === VotingType.MULTIPLE_CHOICE;
  const canVote =
    currentVoting.isOpen && !currentVoting.isFinalized && !submitted;
  const isFinalized = currentVoting.isFinalized;
  const options = currentVoting.options;
  // Use pre-computed totalVotes from the hook
  const totalVotes = currentVoting.totalVotes;

  const handleToggle = (optionId: string) => {
    if (!canVote) return;
    if (isMultiple) {
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((x) => x !== optionId)
          : [...prev, optionId],
      );
    } else {
      setSelectedOptions([optionId]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedOptions.length) return;
    setSubmitting(true);
    setError(null);
    try {
      // castVote now takes CastVoteData — all selected options in one call
      await castVote({ votingId: id, optionIds: selectedOptions });
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.message ?? t.common.error);
    } finally {
      setSubmitting(false);
    }
  };

  const status = currentVoting.status;

  // t.votings has: filterActive, filterScheduled, filterCompleted — no filterUpcoming
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

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />

      {/* Header */}
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
            {currentVoting.startAt && (
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
                {currentVoting.endAt && (
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
              {totalVotes} {t.votings.votes}
            </span>
          </div>
        </div>
      </div>

      {/* Options / Results */}
      <Card className={styles.optionsCard}>
        <h2 className={styles.sectionTitle}>
          {isFinalized || submitted
            ? t.votings.viewResults
            : t.votings.castVote}
        </h2>

        {isMultiple && canVote && currentVoting.minChoices > 1 && (
          <p className={styles.hint}>
            {t.votings.votes}: {currentVoting.minChoices}
            {currentVoting.maxChoices ? ` – ${currentVoting.maxChoices}` : "+"}
          </p>
        )}

        <ul className={styles.optionList}>
          {options.map((option) => {
            const pct =
              totalVotes > 0
                ? Math.round((option.voteCount / totalVotes) * 100)
                : 0;
            const isSelected = selectedOptions.includes(option.id);
            const showResults = isFinalized || submitted || !canVote;

            return (
              <li
                key={option.id}
                className={`${styles.optionItem} ${canVote ? styles.optionClickable : ""} ${isSelected ? styles.optionSelected : ""}`}
                onClick={() => handleToggle(option.id)}
                role={canVote ? "button" : undefined}
                tabIndex={canVote ? 0 : undefined}
                onKeyDown={(e) => e.key === "Enter" && handleToggle(option.id)}
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
        </ul>

        {error && <p className={styles.errorMsg}>{error}</p>}

        {canVote && (
          <div className={styles.submitRow}>
            <Button
              onClick={handleSubmit}
              disabled={selectedOptions.length === 0 || submitting}
              loading={submitting}
            >
              {t.votings.castVote}
            </Button>
          </div>
        )}

        {submitted && !isFinalized && (
          <div className={styles.successMsg}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="20"
              height="20"
            >
              <path d="M9 12l2 2 4-4" />
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t.votings.voted}
          </div>
        )}
      </Card>
    </div>
  );
}
