"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";
import { useVotings } from "@/hooks/api/useVotings";
import styles from "./page.module.css";

const statusStyleMap: Record<string, string> = {
  active: "statusActive",
  upcoming: "statusScheduled",
  completed: "statusCompleted",
  draft: "statusScheduled",
};

export default function VotingsPage() {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "upcoming" | "completed"
  >("all");
  const { votings, loading, fetchVotings } = useVotings();

  useEffect(() => {
    fetchVotings();
  }, [fetchVotings]);

  const filteredVotings = votings.filter((voting) => {
    const matchesSearch =
      voting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (voting.description ?? "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || voting.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusLabels: Record<string, string> = {
    all: t.votings.filterAll,
    active: t.votings.filterActive,
    upcoming: t.votings.filterScheduled,
    completed: t.votings.filterCompleted,
    draft: t.votings.filterScheduled,
  };

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.votings },
  ];

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />

      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>{t.common.votings}</h1>
          <p className={styles.subtitle}>{t.votings.subtitle}</p>
        </div>
        <Button as="link" href="/votings/new">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="20"
            height="20"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t.votings.createVoting}
        </Button>
      </div>

      <div className={styles.filters}>
        <Input
          type="search"
          placeholder={t.votings.searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
        <div className={styles.statusFilters}>
          {(["all", "active", "upcoming", "completed"] as const).map((s) => (
            <button
              key={s}
              className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      {loading && votings.length === 0 ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>{t.common.loading}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {filteredVotings.map((voting) => {
            // Lead option = highest voteCount — shown as the "winning" option
            const leadOption =
              voting.options.length > 0
                ? [...voting.options].sort(
                    (a, b) => b.voteCount - a.voteCount,
                  )[0]
                : null;

            return (
              <Link
                href={`/votings/${voting.id}`}
                key={voting.id}
                className={styles.cardLink}
              >
                <Card className={styles.card} hoverable>
                  <div className={styles.cardContent}>
                    <div className={styles.cardMain}>
                      <div className={styles.cardHeader}>
                        <span
                          className={`${styles.status} ${styles[statusStyleMap[voting.status] ?? "statusScheduled"]}`}
                        >
                          {statusLabels[voting.status]}
                        </span>
                        <span className={styles.groupTag}>
                          {voting.groupName}
                        </span>
                      </div>
                      <h3 className={styles.cardTitle}>{voting.title}</h3>
                      {voting.description && (
                        <p className={styles.cardDescription}>
                          {voting.description}
                        </p>
                      )}
                      {/* Option bars — top 3 options with relative fill */}
                      {voting.totalVotes > 0 && (
                        <div className={styles.optionBars}>
                          {[...voting.options]
                            .sort((a, b) => b.voteCount - a.voteCount)
                            .slice(0, 3)
                            .map((opt) => (
                              <div key={opt.id} className={styles.optionBar}>
                                <div className={styles.optionBarLabel}>
                                  <span className={styles.optionBarText}>
                                    {opt.text}
                                  </span>
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
                        <span className={styles.statValue}>
                          {voting.totalVotes}
                        </span>
                        <span className={styles.statLabel}>
                          {t.votings.votes}
                        </span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statValue}>
                          {voting.options.length}
                        </span>
                        <span className={styles.statLabel}>
                          {t.votings.eligible}
                        </span>
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
                        <rect
                          x="3"
                          y="4"
                          width="18"
                          height="18"
                          rx="2"
                          ry="2"
                        />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {voting.startAt
                        ? new Date(voting.startAt).toLocaleDateString()
                        : "—"}
                      {" – "}
                      {voting.endAt
                        ? new Date(voting.endAt).toLocaleDateString()
                        : "..."}
                    </span>
                    <span className={styles.viewDetails}>
                      {t.votings.viewDetails}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && filteredVotings.length === 0 && (
        <div className={styles.empty}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="48"
            height="48"
          >
            <path d="M9 12l2 2 4-4" />
            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3>{t.votings.noVotingsFound}</h3>
          <p>{t.votings.noVotingsDescription}</p>
        </div>
      )}
    </div>
  );
}
