"use client";

import React from "react";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { SurveyQuestionType } from "@/types/survey";
import { Plus, Trash2, GripVertical } from "lucide-react";
import styles from "./Survey-form.module.css";
import { Toggle } from "../common/Toggle";

interface QuestionDraft {
  type: SurveyQuestionType;
  text: string;
  isRequired: boolean;
  options: string[];
  choiceConfig: {
    allowMultiple: boolean;
    allowOther: boolean;
    minChoices?: number;
    maxChoices?: number;
  };
  scaleConfig: { scaleMin: number; scaleMax: number; step: number };
}

interface SurveyQuestionsEditorProps {
  questions: QuestionDraft[];
  onAddQuestion: () => void;
  onRemoveQuestion: (idx: number) => void;
  onUpdateQuestion: (idx: number, fields: Partial<QuestionDraft>) => void;
  onSetOption: (qIdx: number, oIdx: number, value: string) => void;
  onAddOption: (qIdx: number) => void;
  onRemoveOption: (qIdx: number, oIdx: number) => void;
}

const QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  [SurveyQuestionType.SINGLE_CHOICE]: "Single Choice",
  [SurveyQuestionType.MULTIPLE_CHOICE]: "Multiple Choice",
  [SurveyQuestionType.FREEFORM]: "Freeform Text",
  [SurveyQuestionType.SCALE]: "Scale / Rating",
};

export function SurveyQuestionsEditor({
  questions,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateQuestion,
  onSetOption,
  onAddOption,
  onRemoveOption,
}: SurveyQuestionsEditorProps) {
  return (
    <div className={styles.questionsSection}>
      <div className={styles.questionsList}>
        {questions.map((q, qIdx) => (
          <Card key={qIdx} className={`${styles.questionCard} animate-fade-in-down`}>
            {/* ── Card header ── */}
            <div className={styles.questionCardHeader}>
              <div className={styles.dragHandle}>
                <GripVertical className="w-4 h-4" />
                <span className={styles.questionNumber}>#{qIdx + 1}</span>
              </div>
              <div className={styles.questionActions}>
                <select
                  className={styles.typeSelect}
                  value={q.type}
                  onChange={(e) => {
                    const newType = e.target.value as SurveyQuestionType;
                    const updates: Partial<QuestionDraft> = { type: newType };

                    // Set defaults for Choice types
                    if (newType === SurveyQuestionType.MULTIPLE_CHOICE) {
                      updates.choiceConfig = {
                        ...q.choiceConfig,
                        allowMultiple: true,
                      };
                    } else if (newType === SurveyQuestionType.SINGLE_CHOICE) {
                      updates.choiceConfig = {
                        ...q.choiceConfig,
                        allowMultiple: false,
                      };
                    }

                    onUpdateQuestion(qIdx, updates);
                  }}
                >
                  {Object.entries(QUESTION_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  className={styles.removeBtn}
                  onClick={() => onRemoveQuestion(qIdx)}
                  title="Remove question"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Question body ── */}
            <div className={styles.questionBody}>
              <Input
                value={q.text}
                onChange={(e) =>
                  onUpdateQuestion(qIdx, { text: e.target.value })
                }
                placeholder="Enter question text..."
              />

              {/* Choice options */}
              {(q.type === SurveyQuestionType.SINGLE_CHOICE ||
                q.type === SurveyQuestionType.MULTIPLE_CHOICE) && (
                <div className={styles.optionsEditor}>
                  <span className={styles.innerLabel}>Options</span>
                  <div className={styles.optionList}>
                    {q.options.map((opt, oIdx) => (
                      <div key={oIdx} className={styles.optionRow}>
                        <span className={styles.optionIndex}>{oIdx + 1}</span>
                        <Input
                          value={opt}
                          onChange={(e) =>
                            onSetOption(qIdx, oIdx, e.target.value)
                          }
                          placeholder={`Option ${oIdx + 1}`}
                          className={styles.optionInput}
                        />
                        {q.options.length > 2 && (
                          <button
                            className={styles.removeBtn}
                            onClick={() => onRemoveOption(qIdx, oIdx)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    className={styles.addOptionBtn}
                    onClick={() => onAddOption(qIdx)}
                  >
                    <Plus className="w-3 h-3" /> Add Option
                  </button>

                  <div className={styles.questionSettings}>
                    <Toggle
                      label="Required"
                      checked={q.isRequired}
                      onChange={(checked) =>
                        onUpdateQuestion(qIdx, { isRequired: checked })
                      }
                    />

                    <Toggle
                      label='Allow "Other"'
                      checked={q.choiceConfig.allowOther}
                      onChange={(checked) =>
                        onUpdateQuestion(qIdx, {
                          choiceConfig: {
                            ...q.choiceConfig,
                            allowOther: checked,
                          },
                        })
                      }
                    />

                    {q.type === SurveyQuestionType.MULTIPLE_CHOICE && (
                      <div className="flex gap-4 mt-2">
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Min Choices</label>
                          <Input
                            type="number"
                            min={1}
                            max={q.options.length}
                            value={q.choiceConfig.minChoices ?? 1}
                            onChange={(e) => onUpdateQuestion(qIdx, {
                              choiceConfig: {
                                ...q.choiceConfig,
                                minChoices: parseInt(e.target.value) || 1
                              }
                            })}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Max Choices</label>
                          <Input
                            type="number"
                            min={1}
                            max={q.options.length}
                            value={q.choiceConfig.maxChoices ?? q.options.length}
                            onChange={(e) => onUpdateQuestion(qIdx, {
                              choiceConfig: {
                                ...q.choiceConfig,
                                maxChoices: parseInt(e.target.value) || q.options.length
                              }
                            })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Scale config */}
              {q.type === SurveyQuestionType.SCALE && (
                <div className={styles.scaleConfig}>
                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label}>Min Value</label>
                      <Input
                        type="number"
                        value={q.scaleConfig.scaleMin}
                        onChange={(e) =>
                          onUpdateQuestion(qIdx, {
                            scaleConfig: {
                              ...q.scaleConfig,
                              scaleMin: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Max Value</label>
                      <Input
                        type="number"
                        value={q.scaleConfig.scaleMax}
                        onChange={(e) =>
                          onUpdateQuestion(qIdx, {
                            scaleConfig: {
                              ...q.scaleConfig,
                              scaleMax: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className={styles.questionSettings}>
                    <Toggle
                      label="Required"
                      checked={q.isRequired}
                      onChange={(checked) =>
                        onUpdateQuestion(qIdx, { isRequired: checked })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Freeform */}
              {q.type === SurveyQuestionType.FREEFORM && (
                <div className={styles.questionSettings}>
                  <Toggle
                    label="Required"
                    checked={q.isRequired}
                    onChange={(checked) =>
                      onUpdateQuestion(qIdx, { isRequired: checked })
                    }
                  />
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className={styles.questionsFooter}>
        <Button variant="outline" onClick={onAddQuestion} className={styles.addQuestionBottomBtn}>
          <Plus className="w-4 h-4 mr-2" /> Add Question
        </Button>
      </div>
    </div>
  );
}
