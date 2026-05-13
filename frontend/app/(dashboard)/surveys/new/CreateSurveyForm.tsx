"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useSurveys, CreateSurveyData } from "@/hooks/api/useSurveys";
import { useGroups } from "@/hooks/api/useGroups";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Input } from "@/components/common/Input";
import { SurveyQuestionType } from "@/types/survey";
import { Plus, Trash2, GripVertical, Settings2 } from "lucide-react";
import styles from "./CreateSurveyForm.module.css";

export default function CreateSurveyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { createSurvey } = useSurveys();
  const { groups, fetchGroups } = useGroups();

  const prefilledGroupId = searchParams.get("groupId") ?? "";

  const [form, setForm] = useState({
    title: "",
    description: "",
    groupId: prefilledGroupId,
    isOpen: true,
    allowAbstain: true,
    startAt: "",
    endAt: "",
  });

  const [questions, setQuestions] = useState<any[]>([
    {
      type: SurveyQuestionType.SINGLE_CHOICE,
      text: "",
      isRequired: true,
      options: ["", ""],
      choiceConfig: { allowMultiple: false, allowOther: false },
      scaleConfig: { scaleMin: 1, scaleMax: 5, step: 1 },
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const setField = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        type: SurveyQuestionType.SINGLE_CHOICE,
        text: "",
        isRequired: true,
        options: ["", ""],
        choiceConfig: { allowMultiple: false, allowOther: false },
        scaleConfig: { scaleMin: 1, scaleMax: 5, step: 1 },
      },
    ]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, fields: any) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...fields } : q)),
    );
  };

  const setQuestionOption = (qIdx: number, optIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const nextOpts = [...(q.options || [])];
        nextOpts[optIdx] = value;
        return { ...q, options: nextOpts };
      }),
    );
  };

  const addQuestionOption = (qIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        return { ...q, options: [...(q.options || []), ""] };
      }),
    );
  };

  const removeQuestionOption = (qIdx: number, optIdx: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        return {
          ...q,
          options: (q.options || []).filter(
            (_: any, oi: number) => oi !== optIdx,
          ),
        };
      }),
    );
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError(t.votings.titleRequired);
      return;
    }
    if (!form.groupId) {
      setError(t.votings.groupRequired);
      return;
    }
    if (questions.length === 0) {
      setError("At least one question is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    const data: CreateSurveyData = {
      ...form,
      questions: questions.map((q, idx) => ({
        type: q.type,
        text: q.text,
        isRequired: q.isRequired,
        order: idx,
        options:
          q.type === SurveyQuestionType.SINGLE_CHOICE ||
          q.type === SurveyQuestionType.MULTIPLE_CHOICE
            ? q.options
                .map((o: string, oIdx: number) => ({
                  text: o.trim(),
                  order: oIdx,
                }))
                .filter((o: any) => o.text)
            : undefined,
        choiceConfig:
          q.type === SurveyQuestionType.SINGLE_CHOICE ||
          q.type === SurveyQuestionType.MULTIPLE_CHOICE
            ? q.choiceConfig
            : undefined,
        scaleConfig:
          q.type === SurveyQuestionType.SCALE ? q.scaleConfig : undefined,
      })),
    };

    try {
      const response = await createSurvey(data);
      if (response.data) {
        router.push(`/surveys/${response.data.id}`);
      } else {
        setError(response.error?.message ?? t.common.error);
      }
    } catch (e: any) {
      setError(e?.message ?? t.common.error);
    } finally {
      setSubmitting(false);
    }
  };

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.surveys, href: "/surveys" },
    { label: "Create Survey" },
  ];

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />

      <div className={styles.header}>
        <h1 className={styles.title}>Create New Survey</h1>
        <p className={styles.subtitle}>
          Design your survey questions and targets.
        </p>
      </div>

      <div className={styles.formLayout}>
        <div className={styles.formMain}>
          <Card className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.sectionTitle}>Basic Information</h2>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.field}>
                <label>Survey Title</label>
                <Input
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="e.g. Employee Engagement Q2"
                />
              </div>
              <div className={styles.field}>
                <label>Description (Optional)</label>
                <textarea
                  className={styles.textarea}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="What is this survey about?"
                  rows={3}
                />
              </div>
              <div className={styles.field}>
                <label>Target Group</label>
                <select
                  className={styles.select}
                  value={form.groupId}
                  onChange={(e) => setField("groupId", e.target.value)}
                >
                  <option value="">Select a group...</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <div className={styles.questionsSection}>
            <div className={styles.questionsHeader}>
              <h2 className={styles.sectionTitle}>Questions</h2>
              <Button size="sm" variant="outline" onClick={addQuestion}>
                <Plus className="w-4 h-4 mr-2" /> Add Question
              </Button>
            </div>
            <div className={styles.questionsList}>
              {questions.map((q, qIdx) => (
                <Card key={qIdx} className={styles.questionCard}>
                  <div className={styles.questionCardHeader}>
                    <div className={styles.dragHandle}>
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <span className={styles.questionNumber}>#{qIdx + 1}</span>
                    </div>
                    <div className={styles.questionActions}>
                      <select
                        className={styles.typeSelect}
                        value={q.type}
                        onChange={(e) =>
                          updateQuestion(qIdx, { type: e.target.value })
                        }
                      >
                        <option value={SurveyQuestionType.SINGLE_CHOICE}>
                          Single Choice
                        </option>
                        <option value={SurveyQuestionType.MULTIPLE_CHOICE}>
                          Multiple Choice
                        </option>
                        <option value={SurveyQuestionType.FREEFORM}>
                          Freeform Text
                        </option>
                        <option value={SurveyQuestionType.SCALE}>
                          Scale / Rating
                        </option>
                      </select>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={styles.deleteBtn}
                        onClick={() => removeQuestion(qIdx)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className={styles.questionContent}>
                    <div className={styles.field}>
                      <Input
                        value={q.text}
                        onChange={(e) =>
                          updateQuestion(qIdx, { text: e.target.value })
                        }
                        placeholder="Enter question text..."
                        className={styles.questionTextInput}
                      />
                    </div>

                    {(q.type === SurveyQuestionType.SINGLE_CHOICE ||
                      q.type === SurveyQuestionType.MULTIPLE_CHOICE) && (
                      <div className={styles.optionsEditor}>
                        <label className={styles.innerLabel}>Options</label>
                        <div className={styles.optionsList}>
                          {q.options.map((opt: string, oIdx: number) => (
                            <div key={oIdx} className={styles.optionRow}>
                              <Input
                                value={opt}
                                onChange={(e) =>
                                  setQuestionOption(qIdx, oIdx, e.target.value)
                                }
                                placeholder={`Option ${oIdx + 1}`}
                                className={styles.optionInput}
                              />
                              {q.options.length > 2 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    removeQuestionOption(qIdx, oIdx)
                                  }
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={styles.addOptionBtn}
                          onClick={() => addQuestionOption(qIdx)}
                        >
                          <Plus className="w-3 h-3 mr-2" /> Add Option
                        </Button>

                        <div className={styles.questionSettings}>
                          <label className={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              checked={q.isRequired}
                              onChange={(e) =>
                                updateQuestion(qIdx, {
                                  isRequired: e.target.checked,
                                })
                              }
                            />
                            Required
                          </label>
                          {q.type === SurveyQuestionType.MULTIPLE_CHOICE && (
                            <label className={styles.checkboxLabel}>
                              <input
                                type="checkbox"
                                checked={q.choiceConfig.allowMultiple}
                                onChange={(e) =>
                                  updateQuestion(qIdx, {
                                    choiceConfig: {
                                      ...q.choiceConfig,
                                      allowMultiple: e.target.checked,
                                    },
                                  })
                                }
                              />
                              Allow Multiple
                            </label>
                          )}
                          <label className={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              checked={q.choiceConfig.allowOther}
                              onChange={(e) =>
                                updateQuestion(qIdx, {
                                  choiceConfig: {
                                    ...q.choiceConfig,
                                    allowOther: e.target.checked,
                                  },
                                })
                              }
                            />
                            Allow "Other"
                          </label>
                        </div>
                      </div>
                    )}

                    {q.type === SurveyQuestionType.SCALE && (
                      <div className={styles.scaleConfig}>
                        <div className={styles.grid2}>
                          <div className={styles.field}>
                            <label>Min Value</label>
                            <Input
                              type="number"
                              value={q.scaleConfig.scaleMin}
                              onChange={(e) =>
                                updateQuestion(qIdx, {
                                  scaleConfig: {
                                    ...q.scaleConfig,
                                    scaleMin: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>
                          <div className={styles.field}>
                            <label>Max Value</label>
                            <Input
                              type="number"
                              value={q.scaleConfig.scaleMax}
                              onChange={(e) =>
                                updateQuestion(qIdx, {
                                  scaleConfig: {
                                    ...q.scaleConfig,
                                    scaleMax: Number(e.target.value),
                                  },
                                })
                              }
                            />
                          </div>
                        </div>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={q.isRequired}
                            onChange={(e) =>
                              updateQuestion(qIdx, {
                                isRequired: e.target.checked,
                              })
                            }
                          />
                          Required
                        </label>
                      </div>
                    )}

                    {q.type === SurveyQuestionType.FREEFORM && (
                      <div className={styles.questionSettings}>
                        <label className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={q.isRequired}
                            onChange={(e) =>
                              updateQuestion(qIdx, {
                                isRequired: e.target.checked,
                              })
                            }
                          />
                          Required
                        </label>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.formSidebar}>
          <Card className={styles.sidebarCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.sidebarTitle}>Settings</h3>
            </div>
            <div className={styles.cardContent}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={form.isOpen}
                  onChange={(e) => setField("isOpen", e.target.checked)}
                />
                Is Open
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={form.allowAbstain}
                  onChange={(e) => setField("allowAbstain", e.target.checked)}
                />
                Allow Abstain
              </label>
            </div>
          </Card>

          <Card className={styles.sidebarCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.sidebarTitle}>Scheduling</h3>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.field}>
                <label>Start Date</label>
                <Input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setField("startAt", e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>End Date</label>
                <Input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setField("endAt", e.target.value)}
                />
              </div>
            </div>
          </Card>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            loading={submitting}
            className={styles.submitBtn}
          >
            Create Survey
          </Button>

          <Button
            variant="secondary"
            as="link"
            href="/surveys"
            className={styles.cancelBtn}
          >
            {t.common.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
