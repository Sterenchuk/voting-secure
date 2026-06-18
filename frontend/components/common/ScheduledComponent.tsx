import React from "react";
import { Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import styles from "./ScheduledComponent.module.css";

interface ScheduledComponentProps {
  startAt: string;
  title?: string;
}

export const ScheduledComponent: React.FC<ScheduledComponentProps> = ({
  startAt,
  title,
}) => {
  const { t } = useI18n();
  const startDate = new Date(startAt);

  return (
    <div className={styles.container}>
      <Clock className={styles.icon} />
      <div className={styles.content}>
        <p className={styles.title}>
          {title || t.common.notStarted}
        </p>
        <p className={styles.text}>
          {t.votings.startDate}: {startDate.toLocaleString()}
        </p>
        <p className={styles.subText}>
          {t.common.checkBackLater}
        </p>
      </div>
    </div>
  );
};
