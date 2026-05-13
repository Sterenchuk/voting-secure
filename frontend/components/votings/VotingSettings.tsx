"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/common/Card";
import { Input } from "@/components/common/Input";
import { RadioGroupField } from "@/components/common/RadioGroupField";
import { VotingType } from "@/types/voting";
import styles from "./CreateVotingComponents.module.css";

interface VotingSettingsProps {
  type: VotingType;
  minChoices: number;
  maxChoices: string;
  isOpen: boolean;
  allowOther: boolean;
  allowAbstain: boolean;
  onChange: (field: string, value: any) => void;
}

export function VotingSettings({
  type,
  minChoices,
  maxChoices,
  isOpen,
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

      <div className={styles.toggleRow}>
        <div>
          <span className={styles.toggleLabel}>{t.votings.openImmediately}</span>
          <span className={styles.toggleHint}>{t.votings.openImmediatelyHint}</span>
        </div>
        <button
          type="button"
          className={`${styles.toggle} ${isOpen ? styles.toggleOn : ""}`}
          onClick={() => onChange("isOpen", !isOpen)}
          role="switch"
        >
          <div className={styles.toggleKnob} />
        </button>
      </div>

      <div className={styles.toggleRow}>
        <div>
          <span className={styles.toggleLabel}>{t.votings.allowOther}</span>
          <span className={styles.toggleHint}>{t.votings.allowOtherHint}</span>
        </div>
        <button
          type="button"
          className={`${styles.toggle} ${allowOther ? styles.toggleOn : ""}`}
          onClick={() => onChange("allowOther", !allowOther)}
          role="switch"
        >
          <div className={styles.toggleKnob} />
        </button>
      </div>

      <div className={styles.toggleRow}>
        <div>
          <span className={styles.toggleLabel}>{t.votings.allowAbstain}</span>
          <span className={styles.toggleHint}>{t.votings.allowAbstainHint}</span>
        </div>
        <button
          type="button"
          className={`${styles.toggle} ${allowAbstain ? styles.toggleOn : ""}`}
          onClick={() => onChange("allowAbstain", !allowAbstain)}
          role="switch"
        >
          <div className={styles.toggleKnob} />
        </button>
      </div>
    </Card>
  );
}
