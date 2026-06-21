"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/common/Card";
import { Input } from "@/components/common/Input";
import styles from "./CreateVotingComponents.module.css";

interface Group {
  id: string;
  name: string;
}

interface VotingBasicInfoProps {
  title: string;
  description: string;
  groupId: string;
  groups: Group[];
  onChange: (field: string, value: string) => void;
}

export function VotingBasicInfo({
  title,
  description,
  groupId,
  groups,
  onChange,
}: VotingBasicInfoProps) {
  const { t } = useI18n();

  return (
    <Card className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.votings.basicInfo}</h2>

      <div className={styles.field}>
        <label className={styles.label}>
          {t.profile.name} <span className={styles.required}>*</span>
        </label>
        <Input
          value={title}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder={t.votings.titlePlaceholder}
          maxLength={200}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>{t.profile.bio}</label>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(e) => onChange("description", e.target.value)}
          placeholder={t.votings.descriptionPlaceholder}
          rows={3}
          maxLength={1000}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          {t.common.groups} <span className={styles.required}>*</span>
        </label>
        <select
          className={styles.select}
          value={groupId}
          onChange={(e) => onChange("groupId", e.target.value)}
        >
          <option value="">{t.votings.selectGroup}</option>
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
