"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/hooks/api/useAuth";
import { api } from "@/hooks/api/useApi";
import { Button } from "@/components/common/Button";
import Link from "next/link";
import styles from "../signin/page.module.css";

function VerifyEmailContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { checkAuth } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setErrorMessage("No token provided");
      return;
    }

    const verify = async () => {
      try {
        const response = await api.post("/auth/verify-email", { token });

        if (response.data) {
          setStatus("success");
          // Refresh auth state as cookies are now set
          await checkAuth();
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            router.push("/dashboard");
          }, 2000);
        } else {
          setStatus("error");
          setErrorMessage(response.error?.message || "Verification failed");
        }
      } catch (err) {
        setStatus("error");
        setErrorMessage("An unexpected error occurred");
      }
    };

    verify();
  }, [searchParams, checkAuth, router]);

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
        </div>

        <div className={styles.card}>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            {status === "loading" && (
              <>
                <div className={styles.loadingSpinner} style={{ margin: "0 auto 24px" }} />
                <h1 className={styles.title}>{t.auth.verifyEmail.title}</h1>
                <p className={styles.subtitle}>{t.auth.verifyEmail.subtitle}</p>
              </>
            )}

            {status === "success" && (
              <>
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    backgroundColor: "rgba(5, 150, 105, 0.1)",
                    color: "#059669",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 24px",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    style={{ width: "32px", height: "32px" }}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h1 className={styles.title}>{t.auth.verifyEmail.success}</h1>
                <p className={styles.subtitle}>{t.auth.verifyEmail.successSubtitle}</p>
              </>
            )}

            {status === "error" && (
              <>
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    color: "#ef4444",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 24px",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    style={{ width: "32px", height: "32px" }}
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <h1 className={styles.title}>{t.auth.verifyEmail.error}</h1>
                <p className={styles.subtitle}>{errorMessage || t.auth.verifyEmail.errorSubtitle}</p>
                <div style={{ marginTop: "32px" }}>
                  <Button as="link" href="/signin" fullWidth>
                    {t.auth.verifyEmail.backToSignIn}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
