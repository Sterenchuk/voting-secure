import React from "react";
import { Pencil } from "lucide-react";
import { QuestionProps } from "./types";
import styles from "./SurveyQuestion.module.css";

export function Freeform({ question, answer, onChange }: QuestionProps) {
  return (
    <div className={styles.freeformWrap}>
      <textarea
        className={styles.freeformInput}
        rows={4}
        placeholder="Your answer…"
        value={answer?.text ?? ""}
        onChange={(e) =>
          onChange({
            questionId: question.id,
            type: question.type,
            text: e.target.value,
          })
        }
      />
      <Pencil className={styles.freeformIcon} size={15} />
      <div className={styles.freeformBar} />
    </div>
  );
}
