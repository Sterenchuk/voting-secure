import React, { useState } from "react";
import { QuestionProps } from "./types";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/common/Checkbox";
import styles from "./SurveyQuestion.module.css";

export function MultipleChoice({ question, answer, onChange }: QuestionProps) {
  const [otherText, setOtherText] = useState(answer?.text ?? "");
  const selectedIds = answer?.optionIds ?? [];
  const isOther = answer?.text !== undefined;

  const toggle = (optId: string) => {
    const next = selectedIds.includes(optId)
      ? selectedIds.filter((id) => id !== optId)
      : [...selectedIds, optId];
    onChange({ 
      questionId: question.id, 
      type: question.type, 
      optionIds: next,
      text: answer?.text 
    });
  };

  const toggleOther = () => {
    if (isOther) {
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
  };

  return (
    <div className={styles.questionBody}>
      <ul className={styles.optionList}>
        {question.options
          .filter(opt => !opt.isDynamic)
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((opt) => {
            const isSelected = selectedIds.includes(opt.id);
            return (
              <li
                key={opt.id}
                className={cn(
                  styles.optionItem,
                  styles.optionClickable,
                  isSelected && styles.optionSelected
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onChange={() => toggle(opt.id)}
                  label={<span className={styles.optionText}>{opt.text}</span>}
                  className={styles.fullWidthControl}
                />
              </li>
            );
          })}
        {question.choiceConfig?.allowOther && (
          <li
            className={cn(
              styles.optionItem,
              styles.optionClickable,
              isOther && styles.optionSelected
            )}
          >
            <Checkbox
              checked={isOther}
              onChange={toggleOther}
              label={
                <div className={styles.otherLabelContent}>
                  <span className={styles.optionText}>Other:</span>
                  <input
                    className={styles.otherInput}
                    value={otherText}
                    placeholder="___________________"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      setOtherText(e.target.value);
                      if (isOther) {
                        onChange({
                          questionId: question.id,
                          type: question.type,
                          optionIds: selectedIds,
                          text: e.target.value,
                        });
                      }
                    }}
                  />
                </div>
              }
              className={styles.fullWidthControl}
            />
          </li>
        )}
      </ul>
    </div>
  );
}
