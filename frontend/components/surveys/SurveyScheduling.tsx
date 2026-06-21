"use client";

import React from "react";
import { Card } from "@/components/common/Card";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import styles from "./Survey-form.module.css";

interface SurveySchedulingProps {
  startAt: string;
  endAt: string;
  onChange: (key: string, value: string) => void;
}

export function SurveyScheduling({
  startAt,
  endAt,
  onChange,
}: SurveySchedulingProps) {
  return (
    <Card className={styles.sidebarCard}>
      <h3 className={styles.sidebarTitle}>Scheduling</h3>

      <div className={styles.field}>
        <DateTimePicker
          label="Start Date"
          date={startAt}
          setDate={(val) => onChange("startAt", val)}
          placeholder="Start Date"
        />
      </div>

      <div className={styles.field}>
        <DateTimePicker
          label="End Date"
          date={endAt}
          setDate={(val) => onChange("endAt", val)}
          placeholder="End Date"
        />
      </div>
    </Card>
  );
}
