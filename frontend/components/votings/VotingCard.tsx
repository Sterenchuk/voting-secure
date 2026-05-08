"use client";

import React from "react";
import Link from "next/link";
import { Voting } from "@/hooks/api/useVotings";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/common/Card";
import styles from "./VotingCard.module.css";

interface VotingCardProps {
  voting: Voting;
}

const statusStyleMap: Record<string, string> = {
  active: "statusActive",
  upcoming: "statusScheduled",
  completed: "statusCompleted",
  draft: "statusScheduled",
};

export function VotingCard({ voting }: VotingCardProps) {
  const { t } = useI18n();

  const statusLabels: Record<string, string> = {
    all: t.votings.filterAll,
    active: t.votings.filterActive,
    upcoming: t.votings.filterScheduled,
    completed: t.votings.filterCompleted,
    draft: t.votings.filterScheduled,
  };

  // Prepare preview options including aggregated "Other"
  const previewOptions = [
    ...voting.options.map((o) => ({
      id: o.id,
      text: o.text,
      voteCount: o.voteCount,
      percentage: o.percentage,
    })),
  ];

  if (voting.allowOther && (voting.otherTotal ?? 0) > 0) {
    previewOptions.push({
      id: "OTHER",
      text: t.common.other || "Other",
      voteCount: voting.otherTotal ?? 0,
      percentage: voting.totalVotes > 0 ? ((voting.otherTotal ?? 0) / voting.totalVotes) * 100 : 0,
    });
  }

  // Lead option = highest voteCount — shown as the "winning" option
  const leadOption =
    previewOptions.length > 0
      ? [...previewOptions].sort((a, b) => b.voteCount - a.voteCount)[0]
      : null;

  return (
    <Link href={`/votings/${voting.id}`} className={styles.cardLink}>
      <Card className={styles.card} hoverable>
        <div className={styles.cardContent}>
          <div className={styles.cardMain}>
            <div className={styles.cardHeader}>
              <span
                className={`${styles.status} ${styles[statusStyleMap[voting.status] ?? "statusScheduled"]}`}
              >
                {statusLabels[voting.status]}
              </span>
              <span className={styles.groupTag}>{voting.groupName}</span>
            </div>
            <h3 className={styles.cardTitle}>{voting.title}</h3>
            {voting.description && (
              <p className={styles.cardDescription}>{voting.description}</p>
            )}
            {leadOption && leadOption.voteCount > 0 && (
              <div className={styles.leadOption}>
                <span className={styles.leadLabel}>
                  {voting.status === "completed" ? "Winner:" : "Leading:"}
                </span>
                <span className={styles.leadValue}>
                  {leadOption.text} ({Math.round(leadOption.percentage)}%)
                </span>
              </div>
            )}
            {/* Option bars — top 3 options with relative fill */}
            {voting.totalVotes > 0 && (
              <div className={styles.optionBars}>
                {[...previewOptions]
                  .sort((a, b) => b.voteCount - a.voteCount)
                  .slice(0, 3)
                  .map((opt) => (
                    <div key={opt.id} className={styles.optionBar}>
                      <div className={styles.optionBarLabel}>
                        <span className={styles.optionBarText}>{opt.text}</span>
                        <span className={styles.optionBarPct}>
                          {Math.round(opt.percentage)}%
                        </span>
                      </div>
                      <div className={styles.optionBarTrack}>
                        <div
                          className={styles.optionBarFill}
                          style={{ width: `${opt.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Stats column */}
          <div className={styles.cardStats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{voting.participantsCount}</span>
              <span className={styles.statLabel}>{t.votings.votes}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{voting.options.length}</span>
              <span className={styles.statLabel}>{t.votings.eligible}</span>
            </div>
          </div>
        </div>

        <div className={styles.cardFooter}>
          <span className={styles.dateRange}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="16"
              height="16"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {voting.startAt
              ? new Date(voting.startAt).toLocaleDateString()
              : "—"}
            {" – "}
            {voting.endAt ? new Date(voting.endAt).toLocaleDateString() : "..."}
          </span>
          <span className={styles.viewDetails}>{t.votings.viewDetails}</span>
        </div>
      </Card>
    </Link>
  );
}
