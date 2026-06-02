import React from "react";
import { Card } from "@/components/common/Card";
import { SurveyQuestionType } from "@/types/survey";
import { QuestionProps } from "./types";
import { SingleChoice } from "./SingleChoice";
import { MultipleChoice } from "./MultipleChoice";
import { Scale } from "./Scale";
import { Freeform } from "./Freeform";
import styles from "./SurveyQuestion.module.css";

export function SurveyQuestion(props: QuestionProps) {
  const { question } = props;
  return (
    <Card className={styles.questionCard}>
      <p className={styles.questionText}>
        {question.text}
        {question.isRequired && <span className={styles.required}> *</span>}
      </p>
      {question.type === SurveyQuestionType.SINGLE_CHOICE && (
        <SingleChoice {...props} />
      )}
      {question.type === SurveyQuestionType.MULTIPLE_CHOICE && (
        <MultipleChoice {...props} />
      )}
      {question.type === SurveyQuestionType.SCALE && <Scale {...props} />}
      {question.type === SurveyQuestionType.FREEFORM && <Freeform {...props} />}
    </Card>
  );
}
