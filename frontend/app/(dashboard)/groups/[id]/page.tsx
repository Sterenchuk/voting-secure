"use client";

import React, { useEffect } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useGroups } from "@/hooks/api/useGroups";
import { useVotings } from "@/hooks/api/useVotings";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import styles from "./page.module.css";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const {
    currentGroup,
    fetchGroup,
    loading: groupLoading,
    finalizeVoting,
  } = useGroups();
  const { votings, fetchVotings, loading: votingLoading } = useVotings();

  useEffect(() => {
    if (id) {
      fetchGroup(id);
      fetchVotings({ groupId: id });
    }
  }, [id, fetchGroup, fetchVotings]);

  const handleFinalize = async (votingId: string) => {
    await finalizeVoting(votingId);
    fetchVotings({ groupId: id });
  };

  if (groupLoading || !currentGroup) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>{t.common.loading}</p>
      </div>
    );
  }

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.groups, href: "/groups" },
    { label: currentGroup.name },
  ];

  const members = currentGroup.users ?? [];

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.groupAvatar}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div>
            <h1 className={styles.title}>{currentGroup.name}</h1>
            <p className={styles.subtitle}>
              {new Date(currentGroup.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" as="link" href={`/groups/${id}/edit`}>
            {t.common.edit}
          </Button>
          <Button as="link" href={`/votings/new?groupId=${id}`}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              width="16"
              height="16"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t.groups.createGroup}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <Card className={styles.statCard}>
          <span className={styles.statValue}>{currentGroup.memberCount}</span>
          <span className={styles.statLabel}>{t.groups.members}</span>
        </Card>
      </div>

      <div className={styles.body}>
        {/* Members */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t.groups.members}</h2>
            <Button
              variant="secondary"
              size="sm"
              as="link"
              href={`/groups/${id}/members`}
            >
              {t.groups.manage}
            </Button>
          </div>
          <Card>
            {members.length === 0 ? (
              <div className={styles.emptySection}>
                <p>{t.groups.noGroups}</p>
              </div>
            ) : (
              <ul className={styles.memberList}>
                {members.map((m) => {
                  const displayName = m.user?.name ?? m.user?.email ?? "?";
                  return (
                    <li key={m.id} className={styles.memberRow}>
                      <div className={styles.memberAvatar}>
                        {displayName[0].toUpperCase()}
                      </div>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{displayName}</span>
                        {m.user?.name && (
                          <span className={styles.memberEmail}>
                            {m.user.email}
                          </span>
                        )}
                      </div>
                      <span className={styles.memberRole}>{m.role}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>

        {/* Votings */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t.groups.votings}</h2>
          </div>
          <Card>
            {votingLoading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner} />
              </div>
            ) : votings.length === 0 ? (
              <div className={styles.emptySection}>
                <p>{t.votings.noVotingsDescription}</p>
              </div>
            ) : (
              <ul className={styles.optionList}>
                {votings.map((v) => (
                  <li key={v.id} className={styles.optionItem}>
                    <div className={styles.optionRow}>
                      <span className={styles.optionText}>{v.title}</span>
                      <span className={styles.optionPct}>{v.status}</span>
                    </div>
                    {!v.isFinalized && v.status === "completed" && (
                      <Button size="sm" onClick={() => handleFinalize(v.id)}>
                        Finalize Voting
                      </Button>
                    )}
                    {v.status !== "completed" && !v.isOpen && (
                      <span className={styles.note}>Voting in progress</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
