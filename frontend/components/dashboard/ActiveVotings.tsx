"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { useVotings, Voting } from "@/hooks/api/useVotings";
import { useAuth } from "@/hooks/api/useAuth";
import styles from "./ActiveVotings.module.css";

export function ActiveVotings() {
  const { t } = useI18n();
  const { votings, loading, fetchVotings, finalizeVoting } = useVotings();
  const { user } = useAuth();
  const [finalizingId, setFinalizingId] = useState<string | null>(null);

  useEffect(() => {
    fetchVotings();
  }, [fetchVotings]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRemainingTime = (endAt: string) => {
    const now = new Date();
    const end = new Date(endAt);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return t.votings.closed;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return "Ending soon";
  };

  const handleFinalize = async (id: string) => {
    if (!window.confirm("Are you sure you want to finalize this voting? This will seal the audit chain and generate final results.")) return;
    
    setFinalizingId(id);
    try {
      await finalizeVoting(id);
    } catch (err) {
      console.error("Finalization failed:", err);
    } finally {
      setFinalizingId(null);
    }
  };

  // Filter for active or recently closed votings
  const filteredVotings = votings
    .filter((v) => v.status === "active" || (v.status === "completed" && !v.isFinalized))
    .slice(0, 5);

  const isAdmin = user?.role === "admin";

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
            {filteredVotings.length === 0 ? (
              <p className={styles.empty}>{t.votings.noVotingsFound}</p>
            ) : (
              filteredVotings.map((voting) => {
                const isClosed = voting.status === "completed";
                
                return (
                  <div key={voting.id} className={styles.item}>
                    <div className={styles.info}>
                      <h4 className={styles.title}>{voting.title}</h4>
                      <div className={styles.meta}>
                        <span className={isClosed ? styles.closedMeta : ""}>
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
                          {isClosed ? t.votings.closed : `${t.votings.endDate}: ${voting.endAt ? getRemainingTime(voting.endAt) : "..."}`}
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
                    
                    <div className={styles.actions}>
                      {isClosed ? (
                        <>
                          {isAdmin && !voting.isFinalized && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleFinalize(voting.id)}
                              loading={finalizingId === voting.id}
                            >
                              Finalize
                            </Button>
                          )}
                          <Button
                            as="link"
                            href={`/votings/${voting.id}/results`}
                            size="sm"
                            variant="outline"
                          >
                            Results
                          </Button>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ActiveVotings;
