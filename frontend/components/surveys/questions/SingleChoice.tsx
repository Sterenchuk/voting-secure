import React, { useState } from "react";
import { QuestionProps } from "./types";
import { cn } from "@/lib/utils";
import { Radio } from "@/components/common/Radio";
import styles from "./SurveyQuestion.module.css";

export function SingleChoice({ question, answer, onChange }: QuestionProps) {
  const [otherText, setOtherText] = useState(answer?.text ?? "");
  const isOther = answer?.text !== undefined;
  const selectedId = answer?.optionIds?.[0];

  const handleSelect = (optId: string) => {
    onChange({
      questionId: question.id,
      type: question.type,
      optionIds: [optId],
      text: undefined,
    });
  };

  const handleSelectOther = () => {
    onChange({
      questionId: question.id,
      type: question.type,
      optionIds: [],
      text: otherText,
    });
  };

  return (
    <div className={styles.questionBody}>
      <ul className={styles.optionList}>
        {question.options
          .filter(opt => !opt.isDynamic)
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((opt) => {
            const isSelected = selectedId === opt.id && !isOther;
            return (
              <li
                key={opt.id}
                className={cn(
                  styles.optionItem,
                  styles.optionClickable,
                  isSelected && styles.optionSelected
                )}
              >
                <Radio
                  key={opt.id}
                  name={question.id}
                  checked={isSelected}
                  onChange={() => handleSelect(opt.id)}
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
            <Radio
              name={question.id}
              checked={isOther}
              onChange={handleSelectOther}
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
                          optionIds: [],
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
