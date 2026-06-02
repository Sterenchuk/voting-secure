import React from "react";
import { QuestionProps } from "./types";
import styles from "./SurveyQuestion.module.css";

export function Scale({ question, answer, onChange }: QuestionProps) {
  const cfg = question.scaleConfig ?? { scaleMin: 1, scaleMax: 5, step: 1 };
  const steps: number[] = [];
  for (let v = cfg.scaleMin; v <= cfg.scaleMax; v += cfg.step) steps.push(v);

  return (
    <div className={styles.scaleRow}>
      {steps.map((v, i) => (
        <div
          key={v}
          className={`${styles.scaleStep} ${answer?.scale === v ? styles.scaleStepActive : ""}`}
          onClick={() =>
            onChange({ questionId: question.id, type: question.type, scale: v })
          }
        >
          <span className={styles.scaleNum}>{v}</span>
          <div className={styles.scaleConnector}>
            <div
              className={styles.scaleLine}
              style={{ visibility: i === 0 ? "hidden" : "visible" }}
            />
            <div className={styles.scaleCircle} />
            <div
              className={styles.scaleLine}
              style={{
                visibility: i === steps.length - 1 ? "hidden" : "visible",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
