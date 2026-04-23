"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { useVotings } from "@/hooks/api/useVotings";
import styles from "./ActiveVotings.module.css";

export function ActiveVotings() {
  const { t } = useI18n();
  const { votings, loading, fetchVotings } = useVotings();

  useEffect(() => {
    fetchVotings({ status: "active" });
  }, [fetchVotings]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const activeVotings = votings.filter((v) => v.status === "active").slice(0, 5);

  return (
    <Card padding="lg">
      <CardHeader>
        <div className={styles.headerRow}>
          <CardTitle>{t.dashboard.activeVotings}</CardTitle>
          <Link href="/votings" className={styles.viewAll}>
            View all
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading && votings.length === 0 ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
          </div>
        ) : (
          <div className={styles.list}>
            {activeVotings.length === 0 ? (
              <p className={styles.empty}>{t.votings.noVotingsFound}</p>
            ) : (
              activeVotings.map((voting) => (
                <div key={voting.id} className={styles.item}>
                  <div className={styles.info}>
                    <h4 className={styles.title}>{voting.title}</h4>
                    <div className={styles.meta}>
                      <span>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
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
                        {t.votings.endDate}:{" "}
                        {voting.endDate ? formatDate(voting.endDate) : "..."}
                      </span>
                      <span>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                        </svg>
                        {voting.participantsCount}
                      </span>
                    </div>
                  </div>
                  {voting.hasVoted ? (
                    <span className={styles.votedBadge}>{t.votings.voted}</span>
                  ) : (
                    <Button
                      as="link"
                      href={`/votings/${voting.id}`}
                      size="sm"
                      variant="outline"
                    >
                      {t.votings.castVote}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ActiveVotings;
