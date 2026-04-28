"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/common/Button";
import styles from "./CTASection.module.css";

export function CTASection() {
  const { t } = useI18n();

  return (
    <section className={styles.cta}>
      <div className={styles.container}>
        <div className={styles.content}>
          <h2 className={styles.title}>{t.landing.cta.title}</h2>
          <p className={styles.subtitle}>{t.landing.cta.subtitle}</p>
          <Button as="link" href="/signup" size="lg">
            {t.landing.cta.button}
          </Button>
        </div>

        <div className={styles.decoration}>
          <div className={styles.circle1} />
          <div className={styles.circle2} />
        </div>
      </div>
    </section>
  );
}

export default CTASection;
