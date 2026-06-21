"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/common/Card";
import { DateTimePicker } from "@/components/ui/date-time-picker";
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
        <DateTimePicker
          label={t.votings.startDate}
          date={startAt}
          setDate={(val) => onChange("startAt", val)}
          placeholder={t.votings.startDate}
        />
      </div>

      <div className={styles.field}>
        <DateTimePicker
          label={t.votings.endDate}
          date={endAt}
          setDate={(val) => onChange("endAt", val)}
          placeholder={t.votings.endDate}
        />
      </div>
    </Card>
  );
}
