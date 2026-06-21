"use client";

import React from "react";
import { Card } from "@/components/common/Card";
import { Toggle } from "@/components/common/Toggle";
import styles from "./Survey-form.module.css";

interface SurveySettingsProps {
  isPublic: boolean;
  allowAbstain: boolean;
  onChange: (key: string, value: any) => void;
}

export function SurveySettings({
  isPublic,
  allowAbstain,
  onChange,
}: SurveySettingsProps) {
  return (
    <Card className={styles.sidebarCard}>
      <h3 className={styles.sidebarTitle}>Settings</h3>

      <Toggle
        checked={isPublic}
        onChange={(val) => onChange("isPublic", val)}
        label="Open Survey"
        hint="Participants can submit responses"
      />

      <Toggle
        checked={allowAbstain}
        onChange={(val) => onChange("allowAbstain", val)}
        label="Allow Abstain"
        hint="Participants may skip without answering"
      />
    </Card>
  );
}
