"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { Voting } from "@/hooks/api/useVotings";
import { AuditStatus as IAuditStatus } from "@/hooks/api/useAudit";
import { Button } from "@/components/common/Button";
import {
  ShieldCheck,
  Lock,
  Table,
  FileCode,
  CheckCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import styles from "./AuditStatus.module.css";

interface AuditStatusProps {
  voting: Voting;
  isAdminOrAuditor: boolean;
  onVerifyChain: () => void;
  onExportCsv: () => void;
  onExportEml: () => void;
  onFinalize: () => void;
  auditStatus?: IAuditStatus | null;
}

export function AuditStatus({
  voting,
  isAdminOrAuditor,
  onVerifyChain,
  onExportCsv,
  onExportEml,
  onFinalize,
  auditStatus,
}: AuditStatusProps) {
  const { t } = useI18n();
  const router = useRouter();

  const alreadyVoted = voting.hasVoted;
  const isFinalized = voting.isFinalized;
  const hasEnded = voting.endAt && new Date(voting.endAt) < new Date();

  // canFinalize: Platform Admin or Group Admin/Owner AND not finalized AND has ended AND audit is SECURE
  const userRole = voting.userGroupRole;
  const isGroupAdmin = userRole === "ADMIN" || userRole === "OWNER";
  const hasPermission = isAdminOrAuditor || isGroupAdmin;
  const isSecure = auditStatus?.isSecure ?? false;

  const canFinalize = hasPermission && !isFinalized && hasEnded && isSecure;

  return (
    <div className={styles.auditContainer}>
      {/* Participation Info */}
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

      {(isAdminOrAuditor || isFinalized || isGroupAdmin) && (
        <div className={styles.adminCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardInfo}>
              <Lock className={styles.iconAdmin} />
              <div>
                <h3 className={styles.cardTitle}>
                  {isAdminOrAuditor || isGroupAdmin
                    ? t.votings.auditAdministrative
                    : "Election Results"}
                </h3>
                <p className={styles.cardText}>
                  {isFinalized
                    ? "The results are sealed and cryptographically verified."
                    : t.votings.verifyIntegrityInstructions}
                </p>

                {/* Audit Metadata */}
                {!isFinalized && hasPermission && auditStatus && (
                  <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Last Full Scan:</span>
                      <span className={styles.metaValue}>
                        {auditStatus.lastFullVerificationAt
                          ? new Date(
                              auditStatus.lastFullVerificationAt,
                            ).toLocaleString()
                          : "Never"}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Verified Up To:</span>
                      <span className={styles.metaValue}>
                        Block #{auditStatus.lastVerifiedSequence}
                      </span>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Status:</span>
                      <span
                        className={`${styles.statusBadge} ${isSecure ? styles.statusSecure : styles.statusWarning}`}
                      >
                        {isSecure ? (
                          <>
                            <CheckCircle size={12} className="mr-1" /> SECURE
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={12} className="mr-1" />{" "}
                            UNVERIFIED
                          </>
                        )}
                      </span>
                    </div>
                    {!isSecure && (
                      <div className={styles.secureHint}>
                        <Info size={12} className="mr-1" />
                        {auditStatus.reason ||
                          "Full scan required for finalization."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {(hasPermission || isFinalized) && (
              <div className="flex gap-2 items-start">
                {canFinalize && (
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white font-bold"
                    onClick={onFinalize}
                  >
                    Finalize Voting
                  </Button>
                )}
                {hasPermission && !isFinalized && (
                  <Button variant="secondary" onClick={onVerifyChain}>
                    {t.votings.verifyVotingChain}
                  </Button>
                )}
              </div>
            )}
          </div>

          {(isFinalized || alreadyVoted || hasPermission) && (
            <div className={styles.adminActions}>
              {hasPermission && (
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
