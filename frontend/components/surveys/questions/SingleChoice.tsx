import React, { useState } from "react";
import { QuestionProps } from "./types";
import { cn } from "@/lib/utils";
import { Radio } from "@/components/common/Radio";
import styles from "./SurveyQuestion.module.css";

export function SingleChoice({ question, answer, onChange }: QuestionProps) {
  const [otherText, setOtherText] = useState("");
  const isOther = answer?.text !== undefined && answer?.text !== null;

  return (
    <div className={styles.questionBody}>
      {question.options
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((opt) => {
          const isSelected = answer?.optionIds?.[0] === opt.id && !isOther;
          return (
            <Radio
              key={opt.id}
              name={question.id}
              checked={isSelected}
              onChange={() =>
                onChange({
                  questionId: question.id,
                  type: question.type,
                  optionIds: [opt.id],
                  text: undefined,
                })
              }
              label={opt.text}
              className={cn(styles.choiceLabel, isSelected && styles.choiceLabelSelected)}
            />
          );
        })}
      {question.choiceConfig?.allowOther && (
        <Radio
          name={question.id}
          checked={isOther}
          onChange={() =>
            onChange({
              questionId: question.id,
              type: question.type,
              optionIds: [],
              text: otherText,
            })
          }
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
                    optionIds: [],
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
