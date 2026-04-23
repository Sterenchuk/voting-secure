"use client";

import React from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/common/Button";
import styles from "./HeroSection.module.css";

export function HeroSection() {
  const { t } = useI18n();

  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.badge}>
            <span className={styles.badgeIcon}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </span>
            <span>{t.common.appFullName}</span>
          </div>

          <h1 className={styles.title}>{t.landing.hero.title}</h1>

          <p className={styles.subtitle}>{t.landing.hero.subtitle}</p>

          <div className={styles.actions}>
            <Button as="link" href="/signup" size="lg">
              {t.landing.hero.ctaStart}
            </Button>
            <Button as="link" href="/audit" variant="outline" size="lg">
              {t.landing.hero.ctaAudit}
            </Button>
          </div>

          <div className={styles.trust}>
            <div className={styles.trustItem}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span>256-bit Encryption</span>
            </div>
            <div className={styles.trustItem}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span>99.9% Uptime</span>
            </div>
            <div className={styles.trustItem}>
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
              <span>10K+ Users</span>
            </div>
          </div>
        </div>

        <div className={styles.visual}>
          <div className={styles.visualCard}>
            <div className={styles.visualHeader}>
              <span className={styles.visualTitle}>Live Election Results</span>
              <span className={styles.visualBadge}>Active</span>
            </div>
            <div className={styles.visualChart}>
              <div className={styles.chartBar}>
                <div className={styles.chartLabel}>Option A</div>
                <div className={styles.chartProgress}>
                  <div className={styles.chartFill} style={{ width: "65%" }} />
                </div>
                <div className={styles.chartValue}>65%</div>
              </div>
              <div className={styles.chartBar}>
                <div className={styles.chartLabel}>Option B</div>
                <div className={styles.chartProgress}>
                  <div
                    className={`${styles.chartFill} ${styles.chartFillSecondary}`}
                    style={{ width: "25%" }}
                  />
                </div>
                <div className={styles.chartValue}>25%</div>
              </div>
              <div className={styles.chartBar}>
                <div className={styles.chartLabel}>Option C</div>
                <div className={styles.chartProgress}>
                  <div
                    className={`${styles.chartFill} ${styles.chartFillTertiary}`}
                    style={{ width: "10%" }}
                  />
                </div>
                <div className={styles.chartValue}>10%</div>
              </div>
            </div>
            <div className={styles.visualFooter}>
              <span>1,247 votes cast</span>
              <span className={styles.liveIndicator}>
                <span className={styles.liveDot} />
                Live
              </span>
            </div>
          </div>

          <div className={styles.floatingCard1}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            <span>Vote Verified</span>
          </div>

          <div className={styles.floatingCard2}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span>Encrypted</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
