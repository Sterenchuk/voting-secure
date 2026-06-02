"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/common/Card";
import { Input } from "@/components/common/Input";
import { RadioGroupField } from "@/components/common/RadioGroupField";
import { Toggle } from "@/components/common/Toggle";
import { VotingType } from "@/types/voting";
import styles from "./CreateVotingComponents.module.css";

interface VotingSettingsProps {
  type: VotingType;
  minChoices: number;
  maxChoices: string;
  isPublic: boolean;
  allowOther: boolean;
  allowAbstain: boolean;
  onChange: (field: string, value: any) => void;
}

export function VotingSettings({
  type,
  minChoices,
  maxChoices,
  isPublic,
  allowOther,
  allowAbstain,
  onChange,
}: VotingSettingsProps) {
  const { t } = useI18n();

  return (
    <Card className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.votings.settings}</h2>

      <div className={styles.field}>
        <RadioGroupField
          label={t.votings.type}
          value={type}
          onValueChange={(val) => onChange("type", val)}
          options={[
            { value: VotingType.SINGLE_CHOICE, label: t.votings.singleChoice },
            { value: VotingType.MULTIPLE_CHOICE, label: t.votings.multipleChoice },
          ]}
        />
      </div>

      {type === VotingType.MULTIPLE_CHOICE && (
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>{t.votings.minChoices}</label>
            <Input
              type="number"
              min={1}
              value={String(minChoices)}
              onChange={(e) =>
                onChange("minChoices", Math.max(1, Number(e.target.value)))
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>{t.votings.maxChoices}</label>
            <Input
              type="number"
              min={1}
              value={maxChoices}
              onChange={(e) => onChange("maxChoices", e.target.value)}
              placeholder={t.votings.noLimit}
            />
          </div>
        </div>
      )}

      <Toggle
        checked={isPublic}
        onChange={(val) => onChange("isPublic", val)}
        label={t.votings.isPublic}
        hint={t.votings.isPublicHint}
      />

      <Toggle
        checked={allowOther}
        onChange={(val) => onChange("allowOther", val)}
        label={t.votings.allowOther}
        hint={t.votings.allowOtherHint}
      />

      <Toggle
        checked={allowAbstain}
        onChange={(val) => onChange("allowAbstain", val)}
        label={t.votings.allowAbstain}
        hint={t.votings.allowAbstainHint}
      />
    </Card>
  );
}
