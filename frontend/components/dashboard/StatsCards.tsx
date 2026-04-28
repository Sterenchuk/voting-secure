"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import styles from "./StatsCards.module.css";

export function StatsCards() {
  const { t } = useI18n();

  const stats = [
    {
      label: t.dashboard.stats.totalVotes,
      value: "1,247",
      change: "+12%",
      changeType: "positive" as const,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      ),
    },
    {
      label: t.dashboard.stats.participation,
      value: "78%",
      change: "+5%",
      changeType: "positive" as const,
      icon: (
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
      ),
    },
    {
      label: t.dashboard.stats.activePolls,
      value: "8",
      change: "+2",
      changeType: "positive" as const,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      label: t.dashboard.stats.avgTurnout,
      value: "85%",
      change: "-2%",
      changeType: "negative" as const,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
  ];

  return (
    <div className={styles.grid}>
      {stats.map((stat, index) => (
        <div key={index} className={styles.card}>
          <div className={styles.iconWrapper}>{stat.icon}</div>
          <div className={styles.content}>
            <p className={styles.label}>{stat.label}</p>
            <div className={styles.valueRow}>
              <span className={styles.value}>{stat.value}</span>
              <span
                className={`${styles.change} ${
                  stat.changeType === "positive"
                    ? styles.positive
                    : styles.negative
                }`}
              >
                {stat.change}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default StatsCards;
