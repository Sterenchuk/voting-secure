"use client";

import React from "react";
import { ForensicAuditLogEntry } from "@/hooks/api/useAudit";
import { Badge } from "@/components/ui/badge";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Database } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import styles from "./AuditBlockDetail.module.css";

// ─── Hash diff ────────────────────────────────────────────────────────────────

function HashDiff({
  label,
  actual,
  expected,
  actualLabel = "STORED",
  expectedLabel = "EXPECTED",
}: {
  label: string;
  actual: string;
  expected: string | null | undefined;
  actualLabel?: string;
  expectedLabel?: string;
}) {
  if (!expected || actual === expected) return null;

  const renderDiff = (a: string, b: string, isActual: boolean) =>
    a.split("").map((ch, i) => {
      const differs = ch !== (b[i] ?? "");
      return (
        <span
          key={i}
          className={
            differs
              ? isActual
                ? styles.diffCharBad
                : styles.diffCharGood
              : styles.diffCharOk
          }
        >
          {ch}
        </span>
      );
    });

  return (
    <div className={styles.hashDiffBlock}>
      <div className={styles.hashDiffLabel}>{label}</div>
      <div className={styles.hashDiffRow}>
        <span className={`${styles.hashDiffTag} ${styles.hashDiffTagBad}`}>
          {actualLabel}
        </span>
        <code className={styles.hashDiffCode}>
          {renderDiff(actual, expected, true)}
        </code>
      </div>
      <div className={styles.hashDiffRow}>
        <span className={`${styles.hashDiffTag} ${styles.hashDiffTagGood}`}>
          {expectedLabel}
        </span>
        <code className={styles.hashDiffCode}>
          {renderDiff(expected, actual, false)}
        </code>
      </div>
    </div>
  );
}

// ─── Block detail dialog ──────────────────────────────────────────────────────

interface AuditBlockDetailProps {
  block: ForensicAuditLogEntry;
  type: "voting" | "survey";
}

export function AuditBlockDetail({ block, type }: AuditBlockDetailProps) {
  const isTampered = block.__breakRole === "tampered";
  const isVictim = block.__breakRole === "victim";

  const sequence = type === "voting" ? block.votingSequence : block.surveySequence;
  const prevHash = type === "voting" ? block.votingPrevHash : block.surveyPrevHash;
  const prevHashLabel = type === "voting" ? "VOTING PREV" : "SURVEY PREV";
  const hashLabel = type === "voting" ? "VOTING HASH" : "SURVEY HASH";

  return (
    <DialogContent className={styles.dialogContent}>
      <DialogHeader>
        <DialogTitle className={styles.dialogTitleWrapper}>
          <Database className={styles.dialogTitleIcon} />
          Block #{sequence} Details
          {isTampered && (
            <Badge className={styles.badgeTampered}>
              TAMPERED
            </Badge>
          )}
          {isVictim && (
            <Badge className={styles.badgeVictim}>
              BROKEN LINK
            </Badge>
          )}
        </DialogTitle>

        <DialogDescription asChild>
          <div className={styles.hashBlockContainer}>
            {isTampered ? (
              <>
                <div className={styles.hashRowTampered}>
                  <span className={styles.hashLabelAccent}>
                    {hashLabel} (STORED — CORRUPTED):
                  </span>
                  <span className={styles.corruptedValue}>
                    {block.__corruptedHash ?? block.hash}
                  </span>
                </div>

                {block.__expectedHash && (
                  <div className={styles.hashRowExpected}>
                    <span className={styles.hashLabelExpected}>
                      {hashLabel} (EXPECTED — ORIGINAL):
                    </span>
                    <span className={styles.expectedValue}>
                      {block.__expectedHash}
                    </span>
                  </div>
                )}

                <span>
                  <span className={styles.hashLabelMuted}>
                    {prevHashLabel}:
                  </span>
                  {prevHash || "GENESIS"}
                </span>
                <span className={styles.hashSeparator}>
                  <span className={styles.globalHashLabel}>GLOBAL HASH:</span>
                  {block.hash}
                </span>
                <span className={styles.globalPrevContainer}>
                  <span className={styles.globalHashLabel}>GLOBAL PREV:</span>
                  {block.prevHash}
                </span>
              </>
            ) : isVictim ? (
              <>
                <span>
                  <span className={styles.hashLabelAccent}>{hashLabel}:</span>
                  {block.hash}
                </span>

                <div className={styles.hashRowTampered}>
                  <span className={styles.hashLabelMuted}>
                    {prevHashLabel} (STORED — POINTS TO CORRUPTED):
                  </span>
                  <span className={styles.corruptedValue}>
                    {block.__victimPrevHash ?? prevHash ?? "—"}
                  </span>
                </div>

                {block.__victimExpectedPrevHash && (
                  <div className={styles.hashRowExpected}>
                    <span className={styles.hashLabelExpected}>
                      {prevHashLabel} (EXPECTED — ORIGINAL):
                    </span>
                    <span className={styles.expectedValue}>
                      {block.__victimExpectedPrevHash}
                    </span>
                  </div>
                )}

                <span className={styles.hashSeparator}>
                  <span className={styles.globalHashLabel}>GLOBAL HASH:</span>
                  {block.hash}
                </span>
                <span className={styles.globalPrevContainer}>
                  <span className={styles.globalHashLabel}>GLOBAL PREV:</span>
                  {block.prevHash}
                </span>
              </>
            ) : (
              <>
                <span>
                  <span className={styles.hashLabelAccent}>{hashLabel}:</span>
                  {block.hash}
                </span>
                <span>
                  <span className={styles.hashLabelMuted}>
                    {prevHashLabel}:
                  </span>
                  {prevHash || "GENESIS"}
                </span>
                <span className={styles.hashSeparator}>
                  <span className={styles.globalHashLabel}>GLOBAL HASH:</span>
                  {block.hash}
                </span>
                <span className={styles.globalPrevContainer}>
                  <span className={styles.globalHashLabel}>GLOBAL PREV:</span>
                  {block.prevHash}
                </span>
              </>
            )}
          </div>
        </DialogDescription>
      </DialogHeader>

      {isTampered && block.__corruptedHash && block.__expectedHash && (
        <HashDiff
          label="Hash corruption diff — red characters were changed from the original"
          actual={block.__corruptedHash}
          expected={block.__expectedHash}
          actualLabel="STORED (BAD)"
          expectedLabel="ORIGINAL (GOOD)"
        />
      )}
      {isVictim && block.__victimPrevHash && block.__victimExpectedPrevHash && (
        <HashDiff
          label="Broken link diff — this block's prevHash no longer matches its predecessor"
          actual={block.__victimPrevHash}
          expected={block.__victimExpectedPrevHash}
          actualLabel="STORED PREV (BAD)"
          expectedLabel="EXPECTED PREV (GOOD)"
        />
      )}

      <div className={styles.payloadContainer}>
        <ScrollArea className={styles.scrollArea}>
          <pre className={styles.payloadPre}>
            {JSON.stringify(block.payload, null, 2)}
          </pre>
        </ScrollArea>
      </div>
    </DialogContent>
  );
}
