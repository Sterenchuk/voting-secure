"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { Voting } from "@/hooks/api/useVotings";
import { Button } from "@/components/common/Button";
import { ShieldCheck, Lock, Table, FileCode } from "lucide-react";
import styles from "./AuditStatus.module.css";

interface AuditStatusProps {
  voting: Voting;
  isAdminOrAuditor: boolean;
  onVerifyChain: () => void;
  onExportCsv: () => void;
  onExportEml: () => void;
}

export function AuditStatus({
  voting,
  isAdminOrAuditor,
  onVerifyChain,
  onExportCsv,
  onExportEml,
}: AuditStatusProps) {
  const { t } = useI18n();
  const router = useRouter();

  const alreadyVoted = voting.hasVoted;
  const isFinalized = voting.isFinalized;

  return (
    <div className={styles.auditContainer}>
      {alreadyVoted && (
        <div className={styles.participationCard}>
          <div className={styles.cardInfo}>
            <ShieldCheck className={styles.iconSuccess} />
            <div>
              <h3 className={styles.cardTitle}>
                {t.votings.participationConfirmed}
              </h3>
              <p className={styles.cardText}>
                {t.votings.voteSecurelyRecorded}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(`/votings/${voting.id}/verify`)}
          >
            {t.votings.verifyMyVote}
          </Button>
        </div>
      )}

      {(isAdminOrAuditor || isFinalized) && (
        <div className={styles.adminCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardInfo}>
              <Lock className={styles.iconAdmin} />
              <div>
                <h3 className={styles.cardTitle}>
                  {isAdminOrAuditor ? t.votings.auditAdministrative : "Election Finalized"}
                </h3>
                <p className={styles.cardText}>
                  {isAdminOrAuditor 
                    ? t.votings.verifyIntegrityInstructions 
                    : "The results are sealed and cryptographically verified."}
                </p>
              </div>
            </div>
            {(isAdminOrAuditor || isFinalized) && (
              <Button
                variant="secondary"
                onClick={onVerifyChain}
              >
                {t.votings.verifyVotingChain}
              </Button>
            )}
          </div>
          {(isFinalized || alreadyVoted || isAdminOrAuditor) && (
            <div className={styles.adminActions}>
              {isAdminOrAuditor && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExportCsv}
                  className={styles.actionBtn}
                >
                  <Table className={styles.btnIcon} /> {t.votings.exportCsv}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onExportEml}
                className={styles.actionBtn}
              >
                <FileCode className={styles.btnIcon} /> {t.votings.exportEml}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
