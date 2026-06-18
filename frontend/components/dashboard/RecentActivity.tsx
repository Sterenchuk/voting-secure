"use client";

import React, { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/common/Card";
import { useVotings } from "@/hooks/api/useVotings";
import styles from "./RecentActivity.module.css";

interface ActivityItem {
  id: string;
  type: "vote" | "survey" | "group" | "audit";
  title: string;
  description: string;
  timestamp: string;
}

const getActivityIcon = (type: ActivityItem["type"]) => {
  switch (type) {
    case "vote":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      );
    case "survey":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case "group":
      return (
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
      );
    case "audit":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
  }
};

export function RecentActivity() {
  const { t } = useI18n();
  const { fetchRecentActivity } = useVotings();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentActivity(5).then((res) => {
      if (res.data) {
        setActivities(res.data);
      }
      setLoading(false);
    });
  }, [fetchRecentActivity]);

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle>{t.dashboard.recentActivity}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={styles.list}>
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
            </div>
          ) : activities.length === 0 ? (
            <p className={styles.empty}>No recent activity found</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className={styles.item}>
                <div className={`${styles.icon} ${styles[activity.type]}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className={styles.content}>
                  <p className={styles.title}>{activity.title}</p>
                  <p className={styles.description}>{activity.description}</p>
                </div>
                <span className={styles.timestamp}>
                  {formatTimestamp(activity.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default RecentActivity;
