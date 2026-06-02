import React, { useState } from "react";
import { QuestionProps } from "./types";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/common/Checkbox";
import styles from "./SurveyQuestion.module.css";

export function MultipleChoice({ question, answer, onChange }: QuestionProps) {
  const [otherText, setOtherText] = useState("");
  const selectedIds = answer?.optionIds ?? [];
  const isOther = !!answer?.text;

  const toggle = (optId: string) => {
    const next = selectedIds.includes(optId)
      ? selectedIds.filter((id) => id !== optId)
      : [...selectedIds, optId];
    onChange({ questionId: question.id, type: question.type, optionIds: next });
  };

  return (
    <div className={styles.questionBody}>
      {question.options
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((opt) => {
          const isSelected = selectedIds.includes(opt.id);
          return (
            <Checkbox
              key={opt.id}
              checked={isSelected}
              onChange={() => toggle(opt.id)}
              label={opt.text}
              className={cn(styles.choiceLabel, isSelected && styles.choiceLabelSelected)}
            />
          );
        })}
      {question.choiceConfig?.allowOther && (
        <Checkbox
          checked={isOther}
          onChange={(checked) => {
            if (!checked) {
              onChange({
                questionId: question.id,
                type: question.type,
                optionIds: selectedIds,
                text: undefined,
              });
            } else {
              onChange({
                questionId: question.id,
                type: question.type,
                optionIds: selectedIds,
                text: otherText,
              });
            }
          }}
          label={
            <div className={styles.otherLabelContent}>
              Other:{" "}
              <input
                className={styles.otherInput}
                value={otherText}
                placeholder="Specify…"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  setOtherText(e.target.value);
                  onChange({
                    questionId: question.id,
                    type: question.type,
                    optionIds: selectedIds,
                    text: e.target.value,
                  });
                }}
              />
            </div>
          }
          className={cn(styles.choiceLabel, isOther && styles.choiceLabelSelected)}
        />
      )}
    </div>
  );
}
