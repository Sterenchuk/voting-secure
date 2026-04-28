"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";
import { useAudit } from "@/hooks/api/useAudit";
import { useAuth } from "@/hooks/api/useAuth";
import styles from "./page.module.css";

export default function AuditPage() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { records, loading, fetchAuditRecords, verifyChain, verification } =
    useAudit();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "voting" | "survey">(
    "all",
  );

  useEffect(() => {
    fetchAuditRecords({
      entityType: typeFilter !== "all" ? typeFilter : undefined,
    });
  }, [fetchAuditRecords, typeFilter]);

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      record.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.hash.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.payload.title &&
        record.payload.title
          .toString()
          .toLowerCase()
          .includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const breadcrumbs = [
    { label: t.common.home, href: "/" },
    { label: t.common.audit },
  ];

  const handleVerify = () => {
    verifyChain();
  };

  return (
    <div className={styles.page}>
      <Header isAuthenticated={isAuthenticated} />

      <main className={styles.main}>
        <div className={styles.container}>
          <Breadcrumbs items={breadcrumbs} />

          <div className={styles.header}>
            <div className={styles.headerContent}>
              <h1 className={styles.title}>{t.audit.title}</h1>
              <p className={styles.subtitle}>{t.audit.subtitle}</p>
            </div>
            <Button onClick={handleVerify} loading={loading}>
              Verify Integrity
            </Button>
          </div>

          {verification && (
            <Card
              className={`${styles.infoCard} ${verification.valid ? styles.validCard : styles.invalidCard}`}
            >
              <div className={styles.infoContent}>
                <h3>Chain Verification Result</h3>
                <p>Status: {verification.valid ? "✅ VALID" : "❌ BROKEN"}</p>
                <p>Records checked: {verification.totalChecked}</p>
                {!verification.valid && (
                  <p className={styles.error}>Reason: {verification.reason}</p>
                )}
              </div>
            </Card>
          )}

          <Card className={styles.infoCard}>
            <div className={styles.infoIcon}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="24"
                height="24"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <div className={styles.infoContent}>
              <h3>{t.audit.howItWorks}</h3>
              <p>{t.audit.howItWorksDescription}</p>
            </div>
          </Card>

          <div className={styles.filters}>
            <Input
              type="search"
              placeholder={t.audit.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
            <div className={styles.typeFilters}>
              {(["all", "voting", "survey"] as const).map((type) => (
                <button
                  key={type}
                  className={`${styles.filterBtn} ${typeFilter === type ? styles.filterBtnActive : ""}`}
                  onClick={() => setTypeFilter(type)}
                >
                  {type === "all"
                    ? t.audit.filterAll
                    : t.audit[
                        `filter${type.charAt(0).toUpperCase() + type.slice(1)}s` as keyof typeof t.audit
                      ]}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.list}>
            {loading && records.length === 0 ? (
              <p>Loading audit records...</p>
            ) : (
              filteredRecords.map((record) => (
                <Card
                  key={record.sequence}
                  className={styles.recordCard}
                  hoverable
                >
                  <div className={styles.recordHeader}>
                    <div className={styles.recordType}>
                      {record.votingId ? (
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
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          width="20"
                          height="20"
                        >
                          <path d="M9 11H3v10h18V11h-6M9 7V3h6v4" />
                          <rect x="9" y="7" width="6" height="4" />
                        </svg>
                      )}
                      <span>{record.action}</span>
                    </div>
                    <span className={styles.recordId}>#{record.sequence}</span>
                  </div>

                  <h3 className={styles.recordTitle}>
                    {record.payload.title ||
                      record.payload.name ||
                      "System Event"}
                  </h3>
                  <p className={styles.recordOrg}>
                    Entity ID:{" "}
                    {record.votingId ||
                      record.surveyId ||
                      record.groupId ||
                      record.userId ||
                      "N/A"}
                  </p>

                  <div className={styles.recordStats}>
                    <div className={styles.recordStat}>
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
                      <span>
                        {new Date(record.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className={styles.recordFooter}>
                    <div className={styles.verificationHash}>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        width="16"
                        height="16"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="M9 12l2 2 4-4" />
                      </svg>
                      <span className={styles.hashText}>{record.hash}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      as="link"
                      href={`/audit/hash/${record.hash}`}
                    >
                      {t.audit.viewDetails}
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>

          {!loading && filteredRecords.length === 0 && (
            <div className={styles.empty}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="48"
                height="48"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <h3>{t.audit.noRecordsFound}</h3>
              <p>{t.audit.noRecordsDescription}</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
