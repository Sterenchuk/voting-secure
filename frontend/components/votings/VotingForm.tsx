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
  const canVote = voting.isPublic && !voting.isFinalized && !voting.hasVoted;

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
          const Control = isMultiple ? Checkbox : Radio;
          return (
            <li
              key={option.id}
              className={cn(
                styles.optionItem,
                !tokenRequested && styles.optionClickable,
                isSelected && styles.optionSelected,
              )}
              onClick={() => !tokenRequested && onToggle(option.id)}
            >
              <Control
                checked={isSelected}
                onChange={() => !tokenRequested && onToggle(option.id)}
                disabled={tokenRequested}
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
              !tokenRequested && styles.optionClickable,
              showOtherInput && styles.optionSelected,
            )}
            onClick={() => !tokenRequested && onToggle("OTHER")}
          >
            {isMultiple ? (
              <Checkbox
                checked={showOtherInput}
                onChange={() => !tokenRequested && onToggle("OTHER")}
                disabled={tokenRequested}
                label={
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
                }
                className={styles.fullWidthControl}
              />
            ) : (
              <Radio
                checked={showOtherInput}
                onChange={() => !tokenRequested && onToggle("OTHER")}
                disabled={tokenRequested}
                label={
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
              !tokenRequested && styles.optionClickable,
              isAbstention && styles.optionSelected,
            )}
            onClick={() => !tokenRequested && onToggle("ABSTAIN")}
          >
            <Radio
              checked={isAbstention}
              onChange={() => !tokenRequested && onToggle("ABSTAIN")}
              disabled={tokenRequested}
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
              <Button size="sm" variant="ghost" onClick={onCancelToken}>
                {t.votings.changeSelection}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
