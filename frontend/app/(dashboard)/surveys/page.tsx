"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";
import { useSurveys } from "@/hooks/api/useSurveys";
import styles from "./page.module.css";

const statusStyleMap: Record<string, string> = {
  active: "statusActive",
  draft: "statusDraft",
  completed: "statusCompleted",
};

export default function SurveysPage() {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "draft" | "completed"
  >("all");
  const { surveys, loading, fetchSurveys } = useSurveys();

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  const filteredSurveys = surveys.filter((survey) => {
    const matchesSearch =
      survey.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (survey.description ?? "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || survey.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Available keys: filterAll, filterActive, filterDraft, filterCompleted
  const statusLabels: Record<string, string> = {
    all: t.surveys.filterAll,
    active: t.surveys.filterActive,
    draft: t.surveys.filterDraft,
    completed: t.surveys.filterCompleted,
  };

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.surveys },
  ];

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />

      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>{t.common.surveys}</h1>
          <p className={styles.subtitle}>{t.surveys.subtitle}</p>
        </div>
        <Button as="link" href="/surveys/new">
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
          {t.surveys.createSurvey}
        </Button>
      </div>

      <div className={styles.filters}>
        <Input
          type="search"
          placeholder={t.surveys.searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
        <div className={styles.statusFilters}>
          {(["all", "active", "draft", "completed"] as const).map((s) => (
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

      {loading && surveys.length === 0 ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>{t.common.loading}</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredSurveys.map((survey) => (
            <Link
              href={`/surveys/${survey.id}`}
              key={survey.id}
              className={styles.cardLink}
            >
              <Card className={styles.card} hoverable>
                <div className={styles.cardHeader}>
                  <div className={styles.statusGroup}>
                    <span
                      className={`${styles.status} ${styles[statusStyleMap[survey.status] ?? "statusDraft"]}`}
                    >
                      {statusLabels[survey.status]}
                    </span>
                    {survey.hasParticipated && (
                      <span className={styles.votedBadge}>
                        {t.votings.voted}
                      </span>
                    )}
                  </div>
                  <span className={styles.questionCount}>
                    {survey.questions.length} {t.surveys.questions}
                  </span>
                </div>
                <h3 className={styles.cardTitle}>{survey.title}</h3>
                {survey.description && (
                  <p className={styles.cardDescription}>{survey.description}</p>
                )}
                <div className={styles.cardFooter}>
                  <span className={styles.deadline}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="16"
                      height="16"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    {t.surveys.deadline}:{" "}
                    {survey.endAt
                      ? new Date(survey.endAt).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!loading && filteredSurveys.length === 0 && (
        <div className={styles.empty}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="48"
            height="48"
          >
            <path d="M9 11H3v10h18V11h-6" />
            <path d="M9 7V3h6v4" />
            <rect x="9" y="7" width="6" height="4" />
          </svg>
          <h3>{t.surveys.noSurveysFound}</h3>
          <p>{t.surveys.noSurveysDescription}</p>
        </div>
      )}
    </div>
  );
}
