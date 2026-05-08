"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/common/Card";
import { Input } from "@/components/common/Input";
import styles from "./CreateVotingComponents.module.css";

interface VotingSchedulingProps {
  startAt: string;
  endAt: string;
  onChange: (field: string, value: string) => void;
}

export function VotingScheduling({
  startAt,
  endAt,
  onChange,
}: VotingSchedulingProps) {
  const { t } = useI18n();

  return (
    <Card className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.votings.scheduling}</h2>

      <div className={styles.field}>
        <label className={styles.label}>{t.votings.startDate}</label>
        <Input
          type="datetime-local"
          value={startAt}
          onChange={(e) => onChange("startAt", e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>{t.votings.endDate}</label>
        <Input
          type="datetime-local"
          value={endAt}
          onChange={(e) => onChange("endAt", e.target.value)}
        />
      </div>
    </Card>
  );
}
