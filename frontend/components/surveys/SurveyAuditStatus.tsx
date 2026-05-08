"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { Survey } from "@/hooks/api/useSurveys";
import { Button } from "@/components/common/Button";
import { ShieldCheck, Lock, Table, FileCode } from "lucide-react";
import styles from "./SurveyAuditStatus.module.css";

interface SurveyAuditStatusProps {
  survey: Survey;
  isAdminOrAuditor: boolean;
  onVerifyChain: () => void;
}

export function SurveyAuditStatus({
  survey,
  isAdminOrAuditor,
  onVerifyChain,
}: SurveyAuditStatusProps) {
  const { t } = useI18n();
  const router = useRouter();

  const alreadySubmitted = survey.hasParticipated;
  const isFinalized = survey.isFinalized;

  return (
    <div className={styles.auditContainer}>
      {alreadySubmitted && (
        <div className={styles.participationCard}>
          <div className={styles.cardInfo}>
            <ShieldCheck className={styles.iconSuccess} />
            <div>
              <h3 className={styles.cardTitle}>
                {t.surveys.participationConfirmed || "Participation Confirmed"}
              </h3>
              <p className={styles.cardText}>
                {t.surveys.responseSecurelyRecorded || "Your response has been securely recorded."}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(`/surveys/${survey.id}/verify`)}
          >
            {t.votings.verifyMyVote || "Verify My Response"}
          </Button>
        </div>
      )}

      {isAdminOrAuditor && (
        <div className={styles.adminCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardInfo}>
              <Lock className={styles.iconAdmin} />
              <div>
                <h3 className={styles.cardTitle}>
                  {t.votings.auditAdministrative || "Administrative Audit"}
                </h3>
                <p className={styles.cardText}>
                  {t.votings.verifyIntegrityInstructions || "Verify the integrity of the survey audit chain."}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={onVerifyChain}
            >
              {t.surveys.verifySurveyChain || "Verify Survey Chain"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
