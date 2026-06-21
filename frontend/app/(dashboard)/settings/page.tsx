"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth/context";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Card } from "@/components/common/Card";
import { RadioGroupField } from "@/components/common/RadioGroupField";
import styles from "./page.module.css";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { t, language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const { updateProfile } = useAuth();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState({
    emailVoting: true,
    emailSurvey: true,
    emailResults: false,
    pushVoting: true,
    pushSurvey: false,
    pushResults: true,
  });

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.settings },
  ];

  const handleNotificationChange = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLanguageChange = async (lang: string) => {
    const l = lang as "en" | "uk";
    setLanguage(l);
    try {
      const res = await updateProfile({ language: l });
      if (!res.success) {
        toast({
          title: t.common.error,
          description: res.error?.message || "Failed to update language",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Failed to sync language:", err);
    }
  };

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme);
    try {
      const res = await updateProfile({ theme: newTheme });
      if (!res.success) {
        toast({
          title: t.common.error,
          description: res.error?.message || "Failed to update theme",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Failed to sync theme:", err);
    }
  };

  return (
    <div className={styles.page}>
      <Breadcrumbs items={breadcrumbs} />

      <div className={styles.header}>
        <h1 className={styles.title}>{t.common.settings}</h1>
        <p className={styles.subtitle}>{t.settings.subtitle}</p>
      </div>

      <div className={styles.content}>
        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>{t.settings.appearance}</h3>
          <div className="mt-4">
            <RadioGroupField
              label={t.settings.theme}
              value={theme || "system"}
              onValueChange={handleThemeChange}
              options={[
                { value: "light", label: t.settings.themeLight, description: t.settings.themeDescription },
                { value: "dark", label: t.settings.themeDark, description: t.settings.themeDescription },
                { value: "system", label: t.settings.themeSystem, description: t.settings.themeDescription },
              ]}
            />
          </div>
        </Card>

        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>{t.settings.language}</h3>
          <div className="mt-4">
            <RadioGroupField
              label={t.settings.selectLanguage}
              value={language}
              onValueChange={handleLanguageChange}
              options={[
                { value: "en", label: "English", description: "Standard international version" },
                { value: "uk", label: "Українська", description: "Локалізована версія" },
              ]}
            />
          </div>
        </Card>

        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>{t.settings.notifications}</h3>

          <div className={styles.notificationGroup}>
            <h4 className={styles.notificationGroupTitle}>
              {t.settings.emailNotifications}
            </h4>

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>
                  {t.settings.newVoting}
                </span>
                <span className={styles.settingDescription}>
                  {t.settings.newVotingDescription}
                </span>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={notifications.emailVoting}
                  onChange={() => handleNotificationChange("emailVoting")}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>
                  {t.settings.newSurvey}
                </span>
                <span className={styles.settingDescription}>
                  {t.settings.newSurveyDescription}
                </span>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={notifications.emailSurvey}
                  onChange={() => handleNotificationChange("emailSurvey")}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>
                  {t.settings.resultsReady}
                </span>
                <span className={styles.settingDescription}>
                  {t.settings.resultsReadyDescription}
                </span>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={notifications.emailResults}
                  onChange={() => handleNotificationChange("emailResults")}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
          </div>

          <div className={styles.notificationGroup}>
            <h4 className={styles.notificationGroupTitle}>
              {t.settings.pushNotifications}
            </h4>

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>
                  {t.settings.newVoting}
                </span>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={notifications.pushVoting}
                  onChange={() => handleNotificationChange("pushVoting")}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>
                  {t.settings.newSurvey}
                </span>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={notifications.pushSurvey}
                  onChange={() => handleNotificationChange("pushSurvey")}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>
                  {t.settings.resultsReady}
                </span>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={notifications.pushResults}
                  onChange={() => handleNotificationChange("pushResults")}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
          </div>
        </Card>

        <Card className={styles.section}>
          <h3 className={styles.sectionTitle}>{t.settings.security}</h3>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>
                {t.settings.changePassword}
              </span>
              <span className={styles.settingDescription}>
                {t.settings.changePasswordDescription}
              </span>
            </div>
            <Button variant="outline" size="sm">
              {t.settings.change}
            </Button>
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>
                {t.settings.twoFactor}
              </span>
              <span className={styles.settingDescription}>
                {t.settings.twoFactorDescription}
              </span>
            </div>
            <Button variant="outline" size="sm">
              {t.settings.enable}
            </Button>
          </div>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>
                {t.settings.activeSessions}
              </span>
              <span className={styles.settingDescription}>
                {t.settings.activeSessionsDescription}
              </span>
            </div>
            <Button variant="outline" size="sm">
              {t.settings.manage}
            </Button>
          </div>
        </Card>

        <Card className={`${styles.section} ${styles.dangerZone}`}>
          <h3 className={styles.sectionTitle}>{t.settings.dangerZone}</h3>

          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>
                {t.settings.deleteAccount}
              </span>
              <span className={styles.settingDescription}>
                {t.settings.deleteAccountDescription}
              </span>
            </div>
            <Button variant="outline" size="sm" className={styles.dangerBtn}>
              {t.settings.delete}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
