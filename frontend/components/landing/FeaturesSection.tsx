"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import styles from "./FeaturesSection.module.css";

const EncryptionIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const AnonymousIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

const AuditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const RealtimeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const GroupsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const SurveysIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </svg>
);

export function FeaturesSection() {
  const { t } = useI18n();

  const features = [
    {
      icon: <EncryptionIcon />,
      title: t.landing.features.encryption.title,
      description: t.landing.features.encryption.description,
    },
    {
      icon: <AnonymousIcon />,
      title: t.landing.features.anonymous.title,
      description: t.landing.features.anonymous.description,
    },
    {
      icon: <AuditIcon />,
      title: t.landing.features.audit.title,
      description: t.landing.features.audit.description,
    },
    {
      icon: <RealtimeIcon />,
      title: t.landing.features.realtime.title,
      description: t.landing.features.realtime.description,
    },
    {
      icon: <GroupsIcon />,
      title: t.landing.features.groups.title,
      description: t.landing.features.groups.description,
    },
    {
      icon: <SurveysIcon />,
      title: t.landing.features.surveys.title,
      description: t.landing.features.surveys.description,
    },
  ];

  return (
    <section className={styles.features}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t.landing.features.title}</h2>
          <p className={styles.subtitle}>{t.landing.features.subtitle}</p>
        </div>

        <div className={styles.grid}>
          {features.map((feature, index) => (
            <div key={index} className={styles.card}>
              <div className={styles.iconWrapper}>{feature.icon}</div>
              <h3 className={styles.cardTitle}>{feature.title}</h3>
              <p className={styles.cardDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FeaturesSection;
