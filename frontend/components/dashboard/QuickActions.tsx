"use client";

import React from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/common/Card";
import styles from "./QuickActions.module.css";

export function QuickActions() {
  const { t } = useI18n();

  const actions = [
    {
      href: "/votings/create",
      label: t.dashboard.createVoting,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      ),
      color: "primary",
    },
    {
      href: "/surveys/create",
      label: t.dashboard.createSurvey,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      ),
      color: "secondary",
    },
    {
      href: "/groups/create",
      label: t.dashboard.manageGroups,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
      color: "tertiary",
    },
    {
      href: "/audit",
      label: t.dashboard.viewAudit,
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      color: "default",
    },
  ];

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>{t.dashboard.quickActions}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={styles.grid}>
          {actions.map((action, index) => (
            <Link
              key={index}
              href={action.href}
              className={`${styles.action} ${styles[action.color]}`}
            >
              <span className={styles.icon}>{action.icon}</span>
              <span className={styles.label}>{action.label}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default QuickActions;
