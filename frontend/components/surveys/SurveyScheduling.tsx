"use client";

import React from "react";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";
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
        <label className={styles.label}>Start Date</label>
        <Input
          type="datetime-local"
          value={startAt}
          onChange={(e) => onChange("startAt", e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>End Date</label>
        <Input
          type="datetime-local"
          value={endAt}
          onChange={(e) => onChange("endAt", e.target.value)}
        />
      </div>
    </Card>
  );
}
