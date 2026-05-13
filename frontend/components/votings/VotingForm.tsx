"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import { Voting } from "@/hooks/api/useVotings";
import { VotingType } from "@/types/voting";
import { Button } from "@/components/common/Button";
import { cn } from "@/lib/utils";
import styles from "./VotingForm.module.css";

interface VotingFormProps {
  voting: Voting;
  selectedOptions: string[];
  isAbstention: boolean;
  otherText: string;
  showOtherInput: boolean;
  tokenRequested: boolean;
  submitting: boolean;
  error: string | null;
  onToggle: (optionId: string | "OTHER" | "ABSTAIN") => void;
  onOtherTextChange: (text: string) => void;
  onSubmit: () => void;
  onCancelToken: () => void;
}

export function VotingForm({
  voting,
  selectedOptions,
  isAbstention,
  otherText,
  showOtherInput,
  tokenRequested,
  submitting,
  error,
  onToggle,
  onOtherTextChange,
  onSubmit,
  onCancelToken,
}: VotingFormProps) {
  const { t } = useI18n();

  const isMultiple = voting.type === VotingType.MULTIPLE_CHOICE;
  const options = voting.options;
  const canVote = voting.isOpen && !voting.isFinalized && !voting.hasVoted;

  if (!canVote && !tokenRequested) return null;

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
          return (
            <li
              key={option.id}
              className={cn(
                styles.optionItem,
                !tokenRequested && styles.optionClickable,
                isSelected && styles.optionSelected
              )}
              onClick={() => onToggle(option.id)}
            >
              <div className={styles.optionRow}>
                <div
                  className={cn(
                    styles.optionControl,
                    isSelected && styles.optionControlSelected
                  )}
                >
                  {isMultiple
                    ? isSelected && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          width="12"
                          height="12"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )
                    : isSelected && <div className={styles.radioInner} />}
                </div>
                <span className={styles.optionText}>{option.text}</span>
              </div>
            </li>
          );
        })}

        {voting.allowOther && (
          <li
            className={cn(
              styles.optionItem,
              !tokenRequested && styles.optionClickable,
              showOtherInput && styles.optionSelected
            )}
            onClick={() => onToggle("OTHER")}
          >
            <div className={styles.optionRow}>
              <div
                className={cn(
                  styles.optionControl,
                  showOtherInput && styles.optionControlSelected
                )}
              >
                {isMultiple
                  ? showOtherInput && (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        width="12"
                        height="12"
                      >
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )
                  : showOtherInput && <div className={styles.radioInner} />}
              </div>
              <div className={styles.otherInputInline}>
                <span className={styles.optionText}>{t.common.other}:</span>
                <input
                  type="text"
                  className={styles.inlineInput}
                  placeholder="___________________"
                  value={otherText}
                  disabled={tokenRequested}
                  onChange={(e) => onOtherTextChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          </li>
        )}

        {voting.allowAbstain && (
          <li
            className={cn(
              styles.optionItem,
              !tokenRequested && styles.optionClickable,
              isAbstention && styles.optionSelected
            )}
            onClick={() => onToggle("ABSTAIN")}
          >
            <div className={styles.optionRow}>
              <div
                className={cn(
                  styles.optionControl,
                  isAbstention && styles.optionControlSelected
                )}
              >
                {isAbstention && <div className={styles.radioInner} />}
              </div>
              <span className={styles.optionText}>{t.common.abstain}</span>
            </div>
          </li>
        )}
      </ul>

      {error && <p className={styles.errorMsg}>{error}</p>}

      <div className={styles.submitRow}>
        {!tokenRequested ? (
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
        ) : (
          <div className={styles.emailCheck}>
            <div className={styles.emailCheckHeader}>
              <div className={styles.spinnerSmall} />
              <span>📧 {t.votings.checkEmailToConfirm}</span>
            </div>
            <p className={styles.emailCheckText}>
              {t.votings.emailSentInstructions}
            </p>
            <div className={styles.emailCheckActions}>
              <Button
                size="sm"
                variant="outline"
                onClick={onSubmit}
                disabled={submitting}
              >
                {t.votings.resendEmail}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onCancelToken}
              >
                {t.votings.changeSelection}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
