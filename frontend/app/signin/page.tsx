"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useTheme } from "next-themes";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";
import { useAuth } from "@/hooks/api/useAuth";
import styles from "./page.module.css";

export default function SignInPage() {
  const { t, language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const { signIn, loading, error } = useAuth();
  const router = useRouter();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = t.auth.errors.required;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t.auth.errors.invalidEmail;
    }

    if (!formData.password) {
      newErrors.password = t.auth.errors.required;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const result = await signIn({
      email: formData.email,
      password: formData.password,
      rememberMe: formData.rememberMe,
    });

    if (result.success) {
      router.push("/dashboard");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo}>
            <svg
              className={styles.logoIcon}
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M16 2L4 8v8c0 7.732 5.268 14.864 12 16 6.732-1.136 12-8.268 12-16V8L16 2z"
                fill="currentColor"
                opacity="0.2"
              />
              <path
                d="M16 2L4 8v8c0 7.732 5.268 14.864 12 16 6.732-1.136 12-8.268 12-16V8L16 2z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 16l3 3 5-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{t.common.appName}</span>
          </Link>

          <div className={styles.headerActions}>
            <button
              className={styles.iconButton}
              onClick={() => setLanguage(language === "en" ? "uk" : "en")}
              aria-label="Change language"
            >
              {language.toUpperCase()}
            </button>
            <button
              className={styles.iconButton}
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h1 className={styles.title}>{t.auth.signIn.title}</h1>
            <p className={styles.subtitle}>{t.auth.signIn.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className={styles.errorAlert} role="alert">
                {error.message}
              </div>
            )}

            <Input
              id="email"
              name="email"
              type="email"
              label={t.auth.signIn.email}
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              required
              autoComplete="email"
              leftIcon={
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              }
            />

            <Input
              id="password"
              name="password"
              type="password"
              label={t.auth.signIn.password}
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              required
              autoComplete="current-password"
              leftIcon={
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              }
            />

            <div className={styles.options}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                />
                <span className={styles.checkmark} />
                <span>{t.auth.signIn.rememberMe}</span>
              </label>
              <Link href="#" className={styles.forgotLink}>
                {t.auth.signIn.forgotPassword}
              </Link>
            </div>

            <Button type="submit" fullWidth loading={loading}>
              {t.auth.signIn.submit}
            </Button>
          </form>

          <div className={styles.divider}>
            <span>{t.common.or}</span>
          </div>

          <p className={styles.switchAuth}>
            {t.auth.signIn.noAccount}{" "}
            <Link href="/signup" className={styles.switchLink}>
              {t.auth.signIn.createAccount}
            </Link>
          </p>
        </div>

        <p className={styles.auditLink}>
          <Link href="/audit">{t.nav.auditMode}</Link> - View public election
          audits
        </p>
      </div>
    </div>
  );
}
