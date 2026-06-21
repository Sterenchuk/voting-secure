"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import styles from "./StatsSection.module.css";

export function StatsSection() {
  const { t } = useI18n();

  const stats = [
    {
      value: "2.5M+",
      label: t.landing.stats.votes,
    },
    {
      value: "15K+",
      label: t.landing.stats.elections,
    },
    {
      value: "50K+",
      label: t.landing.stats.users,
    },
    {
      value: "99.9%",
      label: t.landing.stats.uptime,
    },
  ];

  return (
    <section className={styles.stats}>
      <div className={styles.container}>
        {stats.map((stat, index) => (
          <div key={index} className={styles.item}>
            <div className={styles.value}>{stat.value}</div>
            <div className={styles.label}>{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default StatsSection;
