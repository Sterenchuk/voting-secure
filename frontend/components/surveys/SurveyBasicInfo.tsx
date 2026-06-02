"use client";

import React from "react";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";
import styles from "./Survey-form.module.css";

interface Group {
  id: string;
  name: string;
}

interface SurveyBasicInfoProps {
  title: string;
  description: string;
  groupId: string;
  groups: Group[];
  onChange: (key: string, value: any) => void;
}

export function SurveyBasicInfo({
  title,
  description,
  groupId,
  groups,
  onChange,
}: SurveyBasicInfoProps) {
  return (
    <Card className={styles.section}>
      <h2 className={styles.sectionTitle}>Basic Information</h2>

      <div className={styles.field}>
        <label className={styles.label}>
          Survey Title <span className={styles.required}>*</span>
        </label>
        <Input
          value={title}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="e.g. Employee Engagement Q2"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Description</label>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder="What is this survey about?"
          rows={3}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          Target Group <span className={styles.required}>*</span>
        </label>
        <select
          className={styles.select}
          value={groupId}
          onChange={(e) => onChange("groupId", e.target.value)}
        >
          <option value="">Select a group...</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
    </Card>
  );
}
