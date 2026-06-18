"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "@/components/common/Card";
import { Input } from "@/components/common/Input";
import styles from "./CreateVotingComponents.module.css";

interface VotingOptionsEditorProps {
  options: string[];
  setOption: (idx: number, value: string) => void;
  addOption: () => void;
  removeOption: (idx: number) => void;
}

export function VotingOptionsEditor({
  options,
  setOption,
  addOption,
  removeOption,
}: VotingOptionsEditorProps) {
  const { t } = useI18n();

  return (
    <Card className={styles.section}>
      <h2 className={styles.sectionTitle}>{t.votings.options}</h2>
      <p className={styles.sectionHint}>{t.votings.minOptionsHint}</p>

      <div className={styles.optionList}>
        {options.map((opt, idx) => (
          <div key={idx} className={`${styles.optionRow} animate-fade-in-down`}>
            <span className={styles.optionIndex}>{idx + 1}</span>
            <Input
              value={opt}
              onChange={(e) => setOption(idx, e.target.value)}
              placeholder={`${t.votings.optionPlaceholder} ${idx + 1}`}
              className={styles.optionInput}
            />
            {options.length > 2 && (
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => removeOption(idx)}
                aria-label={t.common.delete}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="16"
                  height="16"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className={styles.addOptionBtn}
        onClick={addOption}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          width="16"
          height="16"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        {t.votings.addOption}
      </button>
    </Card>
  );
}
