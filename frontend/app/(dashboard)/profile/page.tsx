"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";
import styles from "./page.module.css";

export default function ProfilePage() {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    phone: "+1 234 567 890",
    organization: "Acme Corporation",
    role: "Senior Manager",
    bio: "Passionate about transparent decision-making and team collaboration.",
  });

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.profile },
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    setIsEditing(false);
    // API call would go here
  };

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />

      <div className={styles.header}>
        <h1 className={styles.title}>{t.common.profile}</h1>
        <p className={styles.subtitle}>{t.profile.subtitle}</p>
      </div>

      <div className={styles.content}>
        <div className={styles.profileSection}>
          <Card className={styles.avatarCard}>
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar}>
                <span>
                  {formData.firstName[0]}
                  {formData.lastName[0]}
                </span>
              </div>
              <Button variant="outline" size="sm">
                {t.profile.changePhoto}
              </Button>
            </div>
            <div className={styles.userInfo}>
              <h2 className={styles.userName}>
                {formData.firstName} {formData.lastName}
              </h2>
              <p className={styles.userRole}>{formData.role}</p>
              <p className={styles.userOrg}>{formData.organization}</p>
            </div>
          </Card>

          <Card className={styles.statsCard}>
            <h3 className={styles.cardTitle}>{t.profile.activityStats}</h3>
            <div className={styles.statsGrid}>
              <div className={styles.stat}>
                <span className={styles.statValue}>47</span>
                <span className={styles.statLabel}>
                  {t.profile.votesParticipated}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>12</span>
                <span className={styles.statLabel}>
                  {t.profile.surveysCompleted}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>5</span>
                <span className={styles.statLabel}>
                  {t.profile.groupsMember}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>8</span>
                <span className={styles.statLabel}>
                  {t.profile.votingsCreated}
                </span>
              </div>
            </div>
          </Card>
        </div>

        <Card className={styles.formCard}>
          <div className={styles.formHeader}>
            <h3 className={styles.cardTitle}>{t.profile.personalInfo}</h3>
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width="16"
                  height="16"
                >
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t.profile.edit}
              </Button>
            ) : (
              <div className={styles.editActions}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  {t.common.cancel}
                </Button>
                <Button size="sm" onClick={handleSave}>
                  {t.common.save}
                </Button>
              </div>
            )}
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>{t.profile.firstName}</label>
              <Input
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>{t.profile.lastName}</label>
              <Input
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>{t.profile.email}</label>
              <Input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>{t.profile.phone}</label>
              <Input
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>{t.profile.organization}</label>
              <Input
                name="organization"
                value={formData.organization}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>{t.profile.role}</label>
              <Input
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.label}>{t.profile.bio}</label>
              <textarea
                name="bio"
                className={styles.textarea}
                value={formData.bio}
                onChange={handleInputChange}
                disabled={!isEditing}
                rows={3}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
