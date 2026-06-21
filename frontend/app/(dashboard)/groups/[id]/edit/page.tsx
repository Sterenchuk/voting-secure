"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGroups } from "@/hooks/api/useGroups";
import { useI18n } from "@/lib/i18n/context";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Card } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { useToast } from "@/hooks/use-toast";
import styles from "./page.module.css";

export default function EditGroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { toast } = useToast();
  const { currentGroup, fetchGroup, updateGroup, loading } = useGroups();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchGroup(id);
    }
  }, [id, fetchGroup]);

  useEffect(() => {
    if (currentGroup) {
      setName(currentGroup.name);
    }
  }, [currentGroup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    const res = await updateGroup(id, { name });
    setSubmitting(false);

    if (!res.error) {
      toast({
        title: "Group Updated",
        description: "Group information has been successfully updated.",
      });
      router.push(`/groups/${id}`);
    } else {
      toast({
        title: "Update Failed",
        description: res.error.message || "Failed to update group.",
        variant: "destructive",
      });
    }
  };

  if (loading && !currentGroup) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.groups, href: "/groups" },
    { label: currentGroup?.name || "Group", href: `/groups/${id}` },
    { label: t.common.edit },
  ];

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />
      
      <div className={styles.header}>
        <h1 className={styles.title}>Edit Group Settings</h1>
      </div>

      <Card className={styles.card}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Group Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
              required
              minLength={3}
            />
          </div>

          <div className={styles.actions}>
            <Button
              variant="secondary"
              type="button"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
