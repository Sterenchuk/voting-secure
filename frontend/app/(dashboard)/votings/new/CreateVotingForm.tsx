"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useVotings, CreateVotingData } from "@/hooks/api/useVotings";
import { useGroups } from "@/hooks/api/useGroups";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { VotingType } from "@/types/voting";
import { VotingBasicInfo } from "@/components/votings/VotingBasicInfo";
import { VotingOptionsEditor } from "@/components/votings/VotingOptionsEditor";
import { VotingSettings } from "@/components/votings/VotingSettings";
import { VotingScheduling } from "@/components/votings/VotingScheduling";
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
    isPublic: true,
    allowOther: true,
    allowAbstain: true,
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

  const setField = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setOption = (idx: number, value: string) =>
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));

  const addOption = () => setOptions((prev) => [...prev, ""]);

  const removeOption = (idx: number) =>
    setOptions((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError(t.votings.titleRequired);
      return;
    }
    if (!form.groupId) {
      setError(t.votings.groupRequired);
      return;
    }
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setError(t.votings.minOptionsRequired);
      return;
    }

    setSubmitting(true);
    setError(null);

    const data: CreateVotingData = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      groupId: form.groupId,
      type: form.type,
      isPublic: form.isPublic,
      allowOther: form.allowOther,
      allowAbstain: form.allowAbstain,
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
        <div className={styles.formMain}>
          <VotingBasicInfo
            title={form.title}
            description={form.description}
            groupId={form.groupId}
            groups={groups}
            onChange={setField}
          />

          <VotingOptionsEditor
            options={options}
            setOption={setOption}
            addOption={addOption}
            removeOption={removeOption}
          />
        </div>

        <div className={styles.formSidebar}>
          <VotingSettings
            type={form.type}
            minChoices={form.minChoices}
            maxChoices={form.maxChoices}
            isPublic={form.isPublic}
            allowOther={form.allowOther}
            allowAbstain={form.allowAbstain}
            onChange={setField}
          />

          <VotingScheduling
            startAt={form.startAt}
            endAt={form.endAt}
            onChange={setField}
          />

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
