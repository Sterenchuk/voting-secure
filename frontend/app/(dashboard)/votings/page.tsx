"use client";

import React, { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { useVotings } from "@/hooks/api/useVotings";
import { VotingCard } from "@/components/votings/VotingCard";
import { VotingFilters, VotingStatusFilter } from "@/components/votings/VotingFilters";
import styles from "./page.module.css";

export default function VotingsPage() {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<VotingStatusFilter>("all");
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

      <VotingFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      {loading && votings.length === 0 ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>{t.common.loading}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {filteredVotings.map((voting) => (
            <VotingCard key={voting.id} voting={voting} />
          ))}
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
