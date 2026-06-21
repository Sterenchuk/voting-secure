"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import { Voting } from "@/hooks/api/useVotings";
import { VotingType } from "@/types/voting";
import styles from "./VotingDetailHeader.module.css";

interface VotingDetailHeaderProps {
  voting: Voting;
}

export function VotingDetailHeader({ voting }: VotingDetailHeaderProps) {
  const { t } = useI18n();

  const isMultiple = voting.type === VotingType.MULTIPLE_CHOICE;
  const statusLabel: Record<string, string> = {
    active: t.votings.filterActive,
    upcoming: t.votings.filterScheduled,
    completed: t.votings.filterCompleted,
    draft: t.votings.filterScheduled,
  };

  return (
    <div className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.badges}>
          <span
            className={`${styles.statusBadge} ${styles[`status_${voting.status}`]}`}
          >
            {statusLabel[voting.status]}
          </span>
          <span className={styles.typeBadge}>
            {isMultiple ? t.votings.filterAll : t.common.voting}
          </span>
        </div>
        <h1 className={styles.title}>{voting.title}</h1>
        {voting.description && (
          <p className={styles.description}>{voting.description}</p>
        )}
        <div className={styles.meta}>
          {voting.startAt &&
            !isNaN(new Date(voting.startAt).getTime()) && (
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
                {new Date(voting.startAt).toLocaleDateString()}
                {voting.endAt &&
                  !isNaN(new Date(voting.endAt).getTime()) && (
                    <>
                      {" "}
                      – {new Date(voting.endAt).toLocaleDateString()}
                    </>
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
            {voting.participantsCount} {t.votings.votes}
          </span>
          <a
            href={`/audit/votings/audit-chain/${voting.id}`}
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
            {t.audit.viewChain}
          </a>
        </div>
      </div>
    </div>
  );
}
