"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import { Input } from "@/components/common/Input";
import styles from "./VotingFilters.module.css";

export type VotingStatusFilter = "all" | "active" | "upcoming" | "completed";

interface VotingFiltersProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  statusFilter: VotingStatusFilter;
  setStatusFilter: (val: VotingStatusFilter) => void;
}

export function VotingFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
}: VotingFiltersProps) {
  const { t } = useI18n();

  const statusLabels: Record<VotingStatusFilter, string> = {
    all: t.votings.filterAll,
    active: t.votings.filterActive,
    upcoming: t.votings.filterScheduled,
    completed: t.votings.filterCompleted,
  };

  return (
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
  );
}
