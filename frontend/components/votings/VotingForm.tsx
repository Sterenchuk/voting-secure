"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import { Voting } from "@/hooks/api/useVotings";
import { VotingType } from "@/types/voting";
import { Button } from "@/components/common/Button";
import { Checkbox } from "@/components/common/Checkbox";
import { Radio } from "@/components/common/Radio";
import { cn } from "@/lib/utils";
import styles from "./VotingForm.module.css";

interface VotingFormProps {
  voting: Voting;
  selectedOptions: string[];
  isAbstention: boolean;
  otherText: string;
  showOtherInput: boolean;
  submitting: boolean;
  error: string | null;
  onToggle: (optionId: string | "OTHER" | "ABSTAIN") => void;
  onOtherTextChange: (text: string) => void;
  onSubmit: () => void;
}

export function VotingForm({
  voting,
  selectedOptions,
  isAbstention,
  otherText,
  showOtherInput,
  submitting,
  error,
  onToggle,
  onOtherTextChange,
  onSubmit,
}: VotingFormProps) {
  const { t } = useI18n();

  const isMultiple = voting.type === VotingType.MULTIPLE_CHOICE;
  const options = voting.options;
  const canVote = voting.isPublic && !voting.isFinalized && !voting.hasVoted;

  if (!canVote) return null;

  return (
    <div className={styles.formSection}>
      {isMultiple && voting.minChoices > 1 && (
        <p className={styles.hint}>
          {t.votings.votes}: {voting.minChoices}
          {voting.maxChoices ? ` – ${voting.maxChoices}` : "+"}
        </p>
      )}

      <ul className={styles.optionList}>
        {options.map((option) => {
          const isSelected = selectedOptions.includes(option.id);
          const Control = isMultiple ? Checkbox : Radio;
          return (
            <li
              key={option.id}
              className={cn(
                styles.optionItem,
                styles.optionClickable,
                isSelected && styles.optionSelected,
              )}
              onClick={() => onToggle(option.id)}
            >
              <Control
                checked={isSelected}
                onChange={() => onToggle(option.id)}
                label={<span className={styles.optionText}>{option.text}</span>}
                className={styles.fullWidthControl}
              />
            </li>
          );
        })}

        {voting.allowOther && (
          <li
            className={cn(
              styles.optionItem,
              styles.optionClickable,
              showOtherInput && styles.optionSelected,
            )}
            onClick={() => onToggle("OTHER")}
          >
            {isMultiple ? (
              <Checkbox
                checked={showOtherInput}
                onChange={() => onToggle("OTHER")}
                label={
                  <div className={styles.otherInputInline}>
                    <span className={styles.optionText}>{t.common.other}:</span>
                    <input
                      type="text"
                      className={styles.inlineInput}
                      placeholder="___________________"
                      value={otherText}
                      onChange={(e) => onOtherTextChange(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                }
                className={styles.fullWidthControl}
              />
            ) : (
              <Radio
                checked={showOtherInput}
                onChange={() => onToggle("OTHER")}
                label={
                  <div className={styles.otherInputInline}>
                    <span className={styles.optionText}>{t.common.other}:</span>
                    <input
                      type="text"
                      className={styles.inlineInput}
                      placeholder="___________________"
                      value={otherText}
                      onChange={(e) => onOtherTextChange(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                }
                className={styles.fullWidthControl}
              />
            )}
          </li>
        )}

        {voting.allowAbstain && (
          <li
            className={cn(
              styles.optionItem,
              styles.optionClickable,
              isAbstention && styles.optionSelected,
            )}
            onClick={() => onToggle("ABSTAIN")}
          >
            <Radio
              checked={isAbstention}
              onChange={() => onToggle("ABSTAIN")}
              label={
                <span className={styles.optionText}>{t.common.abstain}</span>
              }
              className={styles.fullWidthControl}
            />
          </li>
        )}
      </ul>

      {error && <p className={styles.errorMsg}>{error}</p>}

      <div className={styles.submitRow}>
        <Button
          onClick={onSubmit}
          disabled={
            (!isAbstention &&
              selectedOptions.length === 0 &&
              (!showOtherInput || !otherText.trim())) ||
            submitting
          }
          loading={submitting}
        >
          {t.votings.castVote}
        </Button>
      </div>
    </div>
  );
}
