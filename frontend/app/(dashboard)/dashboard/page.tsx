"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { RealtimeChart } from "@/components/dashboard/RealtimeChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { ActiveVotings } from "@/components/dashboard/ActiveVotings";
import { QuickActions } from "@/components/dashboard/QuickActions";
import styles from "./page.module.css";

export default function DashboardPage() {
  const { t } = useI18n();

  return (
    <div className={styles.page}>
      <Breadcrumbs items={[{ label: t.nav.dashboard }]} />

      <div className={styles.header}>
        <h1 className={styles.title}>{t.dashboard.title}</h1>
        <p className={styles.subtitle}>{t.dashboard.welcome}, John!</p>
      </div>

      <StatsCards />

      <div className={styles.grid}>
        <div className={styles.mainColumn}>
          <RealtimeChart />
          <RecentActivity />
        </div>
        <div className={styles.sideColumn}>
          <QuickActions />
          <ActiveVotings />
        </div>
      </div>
    </div>
  );
}
