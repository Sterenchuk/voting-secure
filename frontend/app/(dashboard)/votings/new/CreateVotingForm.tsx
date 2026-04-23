"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useVotings, CreateVotingData } from "@/hooks/api/useVotings";
import { useGroups } from "@/hooks/api/useGroups";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";
import { VotingType } from "@/types/voting";
import styles from "./page.module.css";

export default function CreateVotingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { createVoting } = useVotings();
  const { groups, fetchGroups } = useGroups();

  const prefilledGroupId = searchParams.get("groupId") ?? "";

  const [form, setForm] = useState({
    title: "",
    description: "",
    groupId: prefilledGroupId,
    type: VotingType.SINGLE_CHOICE as VotingType,
    isOpen: true,
    allowOther: false,
    minChoices: 1,
    maxChoices: "",
    startAt: "",
    endAt: "",
  });

  const [options, setOptions] = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const setField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const setOption = (idx: number, value: string) =>
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));

  const addOption = () => setOptions((prev) => [...prev, ""]);

  const removeOption = (idx: number) =>
    setOptions((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    if (!form.groupId) {
      setError("Group is required");
      return;
    }
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setError("At least 2 options are required");
      return;
    }

    setSubmitting(true);
    setError(null);

    const data: CreateVotingData = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      groupId: form.groupId,
      type: form.type,
      isOpen: form.isOpen,
      allowOther: form.allowOther,
      minChoices: form.minChoices,
      maxChoices: form.maxChoices ? Number(form.maxChoices) : undefined,
      options: cleanOptions,
      startAt: form.startAt || undefined,
      endAt: form.endAt || undefined,
    };

    try {
      const response = await createVoting(data);
      if (response.data) {
        router.push(`/votings/${response.data.id}`);
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
    { label: t.common.votings, href: "/votings" },
    { label: t.votings.createVoting },
  ];

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />

      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>{t.votings.createVoting}</h1>
          <p className={styles.subtitle}>{t.votings.subtitle}</p>
        </div>
      </div>

      <div className={styles.formLayout}>
        {/* Main column */}
        <div className={styles.formMain}>
          <Card className={styles.section}>
            <h2 className={styles.sectionTitle}>{t.common.create}</h2>

            <div className={styles.field}>
              <label className={styles.label}>
                Title <span className={styles.required}>*</span>
              </label>
              <Input
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="e.g. Budget allocation Q3"
                maxLength={200}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <textarea
                className={styles.textarea}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Optional description…"
                rows={3}
                maxLength={1000}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                {t.common.groups} <span className={styles.required}>*</span>
              </label>
              <select
                className={styles.select}
                value={form.groupId}
                onChange={(e) => setField("groupId", e.target.value)}
              >
                <option value="">— select group —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          <Card className={styles.section}>
            <h2 className={styles.sectionTitle}>Options</h2>
            <p className={styles.sectionHint}>Minimum 2 options required.</p>

            <div className={styles.optionList}>
              {options.map((opt, idx) => (
                <div key={idx} className={styles.optionRow}>
                  <span className={styles.optionIndex}>{idx + 1}</span>
                  <Input
                    value={opt}
                    onChange={(e) => setOption(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className={styles.optionInput}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removeOption(idx)}
                      aria-label="Remove option"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        width="16"
                        height="16"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              className={styles.addOptionBtn}
              onClick={addOption}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="16"
                height="16"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add option
            </button>
          </Card>
        </div>

        {/* Sidebar */}
        <div className={styles.formSidebar}>
          <Card className={styles.section}>
            <h2 className={styles.sectionTitle}>Settings</h2>

            <div className={styles.field}>
              <label className={styles.label}>Type</label>
              <div className={styles.radioGroup}>
                {(
                  [
                    VotingType.SINGLE_CHOICE,
                    VotingType.MULTIPLE_CHOICE,
                  ] as const
                ).map((vt) => (
                  <label key={vt} className={styles.radioLabel}>
                    <input
                      type="radio"
                      name="type"
                      value={vt}
                      checked={form.type === vt}
                      onChange={() => setField("type", vt)}
                      className={styles.radioInput}
                    />
                    {vt === VotingType.SINGLE_CHOICE
                      ? "Single choice"
                      : "Multiple choice"}
                  </label>
                ))}
              </div>
            </div>

            {form.type === VotingType.MULTIPLE_CHOICE && (
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Min choices</label>
                  <Input
                    type="number"
                    min={1}
                    value={String(form.minChoices)}
                    onChange={(e) =>
                      setField(
                        "minChoices",
                        Math.max(1, Number(e.target.value)),
                      )
                    }
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Max choices</label>
                  <Input
                    type="number"
                    min={1}
                    value={form.maxChoices}
                    onChange={(e) => setField("maxChoices", e.target.value)}
                    placeholder="No limit"
                  />
                </div>
              </div>
            )}

            <div className={styles.toggleRow}>
              <div>
                <span className={styles.toggleLabel}>Open immediately</span>
                <span className={styles.toggleHint}>
                  Voters can submit right away
                </span>
              </div>
              <button
                type="button"
                className={`${styles.toggle} ${form.isOpen ? styles.toggleOn : ""}`}
                onClick={() => setField("isOpen", !form.isOpen)}
                role="switch"
                aria-checked={form.isOpen}
              >
                <span className={styles.toggleThumb} />
              </button>
            </div>

            <div className={styles.toggleRow}>
              <div>
                <span className={styles.toggleLabel}>Allow other</span>
                <span className={styles.toggleHint}>
                  Voters can write a custom answer
                </span>
              </div>
              <button
                type="button"
                className={`${styles.toggle} ${form.allowOther ? styles.toggleOn : ""}`}
                onClick={() => setField("allowOther", !form.allowOther)}
                role="switch"
                aria-checked={form.allowOther}
              >
                <span className={styles.toggleThumb} />
              </button>
            </div>
          </Card>

          <Card className={styles.section}>
            <h2 className={styles.sectionTitle}>
              {t.votings.startDate} / {t.votings.endDate}
            </h2>

            <div className={styles.field}>
              <label className={styles.label}>{t.votings.startDate}</label>
              <Input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setField("startAt", e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>{t.votings.endDate}</label>
              <Input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setField("endAt", e.target.value)}
              />
            </div>
          </Card>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            loading={submitting}
            className={styles.submitBtn}
          >
            {t.votings.createVoting}
          </Button>

          <Button
            variant="secondary"
            as="link"
            href="/votings"
            className={styles.cancelBtn}
          >
            {t.common.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
