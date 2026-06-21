"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useGroups } from "@/hooks/api/useGroups";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Input } from "@/components/common/Input";
import { Plus, Trash2 } from "lucide-react";
import styles from "./CreateGroupForm.module.css";

export default function CreateGroupForm() {
  const router = useRouter();
  const { t } = useI18n();
  const { createGroup } = useGroups();

  const [name, setName] = useState("");
  const [emails, setEmails] = useState<string[]>([""]);
  const [votingIds, setVotingIds] = useState<string[]>([]);
  const [surveyIds, setSurveyIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateEmail = (i: number, val: string) =>
    setEmails((prev) => prev.map((e, idx) => (idx === i ? val : e)));
  const addEmail = () => setEmails((prev) => [...prev, ""]);
  const removeEmail = (i: number) =>
    setEmails((prev) => prev.filter((_, idx) => idx !== i));

  const makeListHelpers = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
  ) => ({
    add: () => setList((p) => [...p, ""]),
    remove: (i: number) => setList((p) => p.filter((_, idx) => idx !== i)),
    update: (i: number, val: string) =>
      setList((p) => p.map((v, idx) => (idx === i ? val : v))),
  });

  const votings = makeListHelpers(votingIds, setVotingIds);
  const surveys = makeListHelpers(surveyIds, setSurveyIds);

  const handleSubmit = async () => {
    setError(null);

    if (!name.trim() || name.trim().length < 3) {
      setError("Group name must be at least 3 characters.");
      return;
    }

    const cleanEmails = emails.map((e) => e.trim()).filter(Boolean);
    if (cleanEmails.length === 0) {
      setError("Provide at least one member email.");
      return;
    }

    const cleanVotings = votingIds.map((v) => v.trim()).filter(Boolean);
    const cleanSurveys = surveyIds.map((s) => s.trim()).filter(Boolean);

    setSubmitting(true);
    const response = await createGroup({
      name: name.trim(),
      userEmails: cleanEmails,
      votingIds: cleanVotings,
      surveyIds: cleanSurveys,
    });
    setSubmitting(false);

    if (response.data) {
      router.push(`/groups/${response.data.id}`);
    } else {
      setError(response.error?.message ?? t.common.error);
    }
  };

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.groups, href: "/groups" },
    { label: "Create group" },
  ];

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />

      <div className={styles.header}>
        <h1 className={styles.title}>Create new group</h1>
        <p className={styles.subtitle}>
          Add members by email and optionally link votings or surveys.
        </p>
      </div>

      <div className={styles.formLayout}>
        <div className={styles.formMain}>
          {/* Basic info */}
          <Card className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.sectionTitle}>Basic information</h2>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.field}>
                <label>Group name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Engineering team"
                />
              </div>
            </div>
          </Card>

          {/* Members */}
          <Card className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.sectionTitle}>Members</h2>
              <span className={styles.cardHint}>At least 1 required</span>
            </div>
            <div className={styles.cardContent}>
              <div className={styles.emailList}>
                {emails.map((email, i) => (
                  <div key={i} className={styles.emailRow}>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(i, e.target.value)}
                      placeholder="user@example.com"
                      className={styles.emailInput}
                    />
                    {emails.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeEmail(i)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className={styles.addBtn}
                onClick={addEmail}
              >
                <Plus className="w-3 h-3 mr-2" /> Add another email
              </Button>
            </div>
          </Card>

          {/* Voting IDs */}
          <Card className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.sectionTitle}>
                Linked votings{" "}
                <span className={styles.optionalTag}>optional</span>
              </h2>
            </div>
            <div className={styles.cardContent}>
              {votingIds.map((v, i) => (
                <div key={i} className={styles.emailRow}>
                  <Input
                    value={v}
                    onChange={(e) => votings.update(i, e.target.value)}
                    placeholder="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => votings.remove(i)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className={styles.addBtn}
                onClick={votings.add}
              >
                <Plus className="w-3 h-3 mr-2" /> Add voting ID
              </Button>
            </div>
          </Card>

          {/* Survey IDs */}
          <Card className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.sectionTitle}>
                Linked surveys{" "}
                <span className={styles.optionalTag}>optional</span>
              </h2>
            </div>
            <div className={styles.cardContent}>
              {surveyIds.map((s, i) => (
                <div key={i} className={styles.emailRow}>
                  <Input
                    value={s}
                    onChange={(e) => surveys.update(i, e.target.value)}
                    placeholder="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => surveys.remove(i)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className={styles.addBtn}
                onClick={surveys.add}
              >
                <Plus className="w-3 h-3 mr-2" /> Add survey ID
              </Button>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className={styles.formSidebar}>
          <Card className={styles.sidebarCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.sidebarTitle}>Preview</h3>
            </div>
            <div className={styles.cardContent}>
              {!name && emails.every((e) => !e.trim()) ? (
                <p className={styles.previewEmpty}>
                  Fill in the form to see a preview.
                </p>
              ) : (
                <>
                  {name && (
                    <div className={styles.previewRow}>
                      <span className={styles.previewLabel}>Name</span>
                      <span className={styles.previewValue}>{name}</span>
                    </div>
                  )}
                  {emails.filter(Boolean).length > 0 && (
                    <div className={styles.previewRow}>
                      <span className={styles.previewLabel}>
                        Members ({emails.filter((e) => e.trim()).length})
                      </span>
                      <div className={styles.tagList}>
                        {emails
                          .filter((e) => e.trim())
                          .map((e, i) => (
                            <span key={i} className={styles.tag}>
                              {e}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            loading={submitting}
            className={styles.submitBtn}
          >
            Create group
          </Button>

          <Button
            variant="secondary"
            as="link"
            href="/groups"
            className={styles.cancelBtn}
          >
            {t.common.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
