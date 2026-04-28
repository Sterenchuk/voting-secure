"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";
import { useGroups } from "@/hooks/api/useGroups";
import styles from "./page.module.css";

export default function GroupsPage() {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState("");
  const { groups, loading, fetchGroups } = useGroups();

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.groups },
  ];

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />

      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>{t.common.groups}</h1>
          <p className={styles.subtitle}>{t.groups.subtitle}</p>
        </div>
        <Button as="link" href="/groups/new">
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
          {t.groups.createGroup}
        </Button>
      </div>

      <div className={styles.filters}>
        <Input
          type="search"
          placeholder={t.groups.searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {loading && groups.length === 0 ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredGroups.map((group) => (
            <Link
              href={`/groups/${group.id}`}
              key={group.id}
              className={styles.cardLink}
            >
              <Card className={styles.card} hoverable>
                <div className={styles.cardHeader}>
                  <div className={styles.groupIcon}>
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
                  {group.isMember && (
                    <span className={styles.memberBadge}>
                      {t.groups.manage}
                    </span>
                  )}
                </div>
                <h3 className={styles.cardTitle}>{group.name}</h3>
                <div className={styles.cardMeta}>
                  <span className={styles.metaItem}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="16"
                      height="16"
                    >
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {group.memberCount} {t.groups.members}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!loading && filteredGroups.length === 0 && (
        <div className={styles.empty}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="48"
            height="48"
          >
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
          <h3>{t.groups.noGroupsFound}</h3>
          <p>{t.groups.noGroupsDescription}</p>
        </div>
      )}
    </div>
  );
}
