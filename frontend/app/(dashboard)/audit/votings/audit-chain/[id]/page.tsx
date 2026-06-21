"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ForensicAuditLogEntry,
  ChainIntegrityResult,
  useAudit,
} from "@/hooks/api/useAudit";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Search,
  ShieldCheck,
  Eye,
  RefreshCcw,
  Database,
  AlertTriangle,
  X,
  ScanSearch,
} from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useI18n } from "@/lib/i18n/context";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AuditBlockDetail } from "@/components/audit/AuditBlockDetail";
import styles from "./page.module.css";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VotingChainExplorerPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const {
    blocks,
    loading,
    integrity,
    fetchVotingChain,
    fetchCompromisedBlocks,
    startAsyncVerification,
    getVerificationStatus,
    getAuditStatus,
    status: auditStatus,
    saveIntegrityToCache,
    loadIntegrityFromCache,
    clearIntegrityCache,
  } = useAudit();

  const [searchHash, setSearchHash] = useState("");
  const [searchSequence, setSearchSequence] = useState("");
  const [searchAction, setSearchAction] = useState("");
  const [activeAction, setActiveAction] = useState("");

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [showCompromisedOnly, setShowCompromisedOnly] = useState(false);
  const [showSequenceGaps, setShowSequenceGaps] = useState(false);
  const [compromisedBlocks, setCompromisedBlocks] = useState<
    ForensicAuditLogEntry[]
  >([]);

  // When checked, clears both the localStorage integrity cache and the DB-level
  // lastVerifiedSequence before running the compromised block scan. Use this
  // when the cached result doesn't match what you expect — e.g. the tamper
  // happened at a sequence that was already marked verified before tampering.
  const [forceRescan, setForceRescan] = useState(false);
  const [compromisedLoading, setCompromisedLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchVotingChain(id);
      loadIntegrityFromCache("voting", id);
      getAuditStatus("voting", id);
    }
  }, [id, fetchVotingChain, loadIntegrityFromCache, getAuditStatus]);

  const sequenceGaps = useMemo(() => {
    const gaps: number[] = [];
    for (let i = 0; i < blocks.length - 1; i++) {
      const cur = blocks[i].votingSequence;
      const nxt = blocks[i + 1].votingSequence;
      if (cur != null && nxt != null && cur !== nxt + 1) gaps.push(cur);
    }
    return gaps;
  }, [blocks]);

  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(async () => {
      const response = await getVerificationStatus(activeJobId);
      if (response.data) {
        setJobStatus(response.data);
        if (
          response.data.status === "completed" ||
          response.data.status === "failed"
        ) {
          setActiveJobId(null);
          if (response.data.status === "completed" && response.data.result) {
            saveIntegrityToCache(response.data.result);
          }
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeJobId, getVerificationStatus, saveIntegrityToCache]);

  const doFetch = useCallback(
    (overrides?: { hash?: string; sequence?: string; action?: string }) => {
      if (!id) return;
      fetchVotingChain(id, 1, 50, {
        hash: overrides?.hash ?? searchHash,
        sequence: overrides?.sequence ?? searchSequence,
        action: overrides?.action ?? activeAction,
      });
    },
    [id, fetchVotingChain, searchHash, searchSequence, activeAction],
  );

  const onSearch = () => {
    setActiveAction(searchAction);
    if (!id) return;
    fetchVotingChain(id, 1, 50, {
      hash: searchHash,
      sequence: searchSequence,
      action: searchAction,
    });
  };

  const onRefresh = () => doFetch();

  const applyActionFilter = (action: string) => {
    const next = activeAction === action ? "" : action;
    setSearchAction(next);
    setActiveAction(next);
    if (!id) return;
    fetchVotingChain(id, 1, 50, {
      hash: searchHash,
      sequence: searchSequence,
      action: next,
    });
  };

  const clearFilters = () => {
    setSearchHash("");
    setSearchSequence("");
    setSearchAction("");
    setActiveAction("");
    if (id) fetchVotingChain(id, 1, 50, {});
  };

  const handleShowCompromised = async (checked: boolean) => {
    setShowCompromisedOnly(checked);
    if (checked && id) {
      setCompromisedLoading(true);
      // If forceRescan is on, wipe the localStorage integrity cache too so the
      // alert banner updates after the fresh scan completes.
      if (forceRescan) {
        clearIntegrityCache("voting", id);
      }
      const response = await fetchCompromisedBlocks("voting", id, forceRescan);
      setCompromisedLoading(false);
      if (response.data && Array.isArray(response.data.records)) {
        setCompromisedBlocks(response.data.records);
      } else {
        setCompromisedBlocks([]);
      }
    } else {
      setCompromisedBlocks([]);
    }
  };

  // Re-run the compromised fetch whenever forceRescan toggles while the
  // compromised view is already open, so the user doesn't have to uncheck
  // and recheck the main checkbox.
  const handleForceRescanChange = async (checked: boolean) => {
    setForceRescan(checked);
    if (showCompromisedOnly && id) {
      setCompromisedLoading(true);
      if (checked) {
        clearIntegrityCache("voting", id);
      }
      const response = await fetchCompromisedBlocks("voting", id, checked);
      setCompromisedLoading(false);
      if (response.data && Array.isArray(response.data.records)) {
        setCompromisedBlocks(response.data.records);
      } else {
        setCompromisedBlocks([]);
      }
    }
  };

  const handleStartVerification = async (forceFull = false) => {
    if (!id) return;
    const response = await startAsyncVerification("voting", id, forceFull);
    if (response.data?.jobId) {
      setActiveJobId(response.data.jobId);
      setJobStatus({ status: "pending", progress: 0 });
    }
  };

  const jumpToBrokenBlock = () => {
    if (!currentIntegrity?.brokenAt) return;
    const seq = String(currentIntegrity.brokenAt);
    setSearchSequence(seq);
    setActiveAction("");
    setSearchAction("");
    if (!id) return;
    fetchVotingChain(id, 1, 50, { sequence: seq });
  };

  const currentIntegrity: ChainIntegrityResult | null =
    jobStatus?.status === "completed" ? jobStatus.result : integrity;

  const filteredBlocks = useMemo((): ForensicAuditLogEntry[] => {
    if (showCompromisedOnly) return compromisedBlocks;
    let list = blocks as ForensicAuditLogEntry[];
    if (showSequenceGaps && sequenceGaps.length > 0) {
      list = list.filter((b) =>
        sequenceGaps.some(
          (gapSeq) =>
            b.votingSequence === gapSeq || b.votingSequence === gapSeq - 1,
        ),
      );
    }
    return list;
  }, [
    blocks,
    showSequenceGaps,
    sequenceGaps,
    compromisedBlocks,
    showCompromisedOnly,
  ]);

  const getBreakRole = (
    block: ForensicAuditLogEntry,
  ): "tampered" | "victim" | null => {
    if (showCompromisedOnly && block.__breakRole) return block.__breakRole;

    if (
      !currentIntegrity ||
      currentIntegrity.valid ||
      !currentIntegrity.brokenAt
    )
      return null;

    const seq = block.votingSequence ?? block.sequence;

    if (
      currentIntegrity.errorType === "TAMPERED_HASH" &&
      seq === currentIntegrity.brokenAt
    ) {
      return "tampered";
    }

    if (
      currentIntegrity.errorType === "BROKEN_LINK" &&
      seq === currentIntegrity.brokenAt
    ) {
      return "victim";
    }

    if (
      currentIntegrity.errorType === "BROKEN_LINK" &&
      seq === currentIntegrity.brokenAt - 1
    ) {
      return "tampered";
    }

    if (
      currentIntegrity.errorType === "TAMPERED_HASH" &&
      seq === currentIntegrity.brokenAt + 1
    ) {
      return "victim";
    }

    return null;
  };

  const isGapBlock = (seq: number | null | undefined) =>
    seq != null && sequenceGaps.includes(seq);

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: "Audit Hub", href: "/audit" },
    { label: id.slice(0, 8), href: `/audit/votings/${id}` },
    { label: "Audit Chain" },
  ];

  const hasActiveFilters =
    searchHash ||
    searchSequence ||
    activeAction ||
    showCompromisedOnly ||
    showSequenceGaps;

  return (
    <div className={styles.surveyPage}>
      <Breadcrumbs items={breadcrumbs} />

      <div className={styles.surveyPageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            Voting Audit Chain
          </h1>
          <p className={styles.pageSubtitle}>
            Immutable cryptographic sub-chain for voting {id}.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading || !!activeJobId}
            className={styles.actionButton}
          >
            <RefreshCcw
              className={`${styles.refreshIcon} ${loading ? styles.animateSpin : ""}`}
            />
            Refresh
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStartVerification(false)}
              disabled={loading || !!activeJobId}
              className={styles.actionButton}
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Incremental Scan
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStartVerification(true)}
              disabled={
                loading || 
                !!activeJobId || 
                (!!auditStatus?.lastFullVerificationAt && 
                 (Date.now() - new Date(auditStatus.lastFullVerificationAt).getTime() < 24 * 3600 * 1000))
              }
              className={`${styles.verifyButton} ${styles.actionButton}`}
              title={
                auditStatus?.lastFullVerificationAt && 
                (Date.now() - new Date(auditStatus.lastFullVerificationAt).getTime() < 24 * 3600 * 1000)
                  ? "Full scan is limited to once per 24 hours"
                  : "Perform full scan from genesis"
              }
            >
              <ScanSearch className="w-4 h-4 mr-2" />
              Full Scan
            </Button>
          </div>
        </div>
      </div>

      {activeJobId && (
        <Card className={styles.progressCard}>
          <CardContent className={styles.cardContentPt6}>
            <div className={styles.progressHeader}>
              <div className={styles.progressInfo}>
                <RefreshCcw className={styles.progressIcon} />
                <span className={styles.progressLabel}>
                  {jobStatus?.status === "processing"
                    ? "Verifying Linkage..."
                    : "Queuing Job..."}
                </span>
              </div>
              <span className={styles.progressPercent}>
                {jobStatus?.progress || 0}%
              </span>
            </div>
            <Progress
              value={jobStatus?.progress || 0}
              className={styles.progressBar}
            />
            <p className={styles.progressDescription}>
              Background worker is validating cryptographic hashes and sequence
              integrity
            </p>
          </CardContent>
        </Card>
      )}

      {currentIntegrity && (
        <Alert
          variant={currentIntegrity.valid ? "default" : "destructive"}
          className={styles.integrityAlert}
        >
          <div className={styles.alertTitleWrapper}>
            {currentIntegrity.valid ? (
              <ShieldCheck className={styles.alertIconSecure} />
            ) : (
              <AlertTriangle className={styles.alertIconCompromised} />
            )}
            <AlertTitle className={styles.alertTitleText}>
              {currentIntegrity.valid ? "Chain Secure" : "Chain Compromised"}
            </AlertTitle>
          </div>
          <AlertDescription className={styles.alertContent}>
            <div className={styles.alertDescriptionContent}>
              {currentIntegrity.valid
                ? `Verified ${currentIntegrity.totalChecked} blocks. All links are secure.`
                : `Break detected at sequence #${currentIntegrity.brokenAt}. Reason: ${currentIntegrity.reason}`}
            </div>
            {currentIntegrity.verifiedAt && (
              <div className={styles.verifiedAt}>
                Last verified:{" "}
                {format(currentIntegrity.verifiedAt, "PPP, HH:mm:ss")}
              </div>
            )}
            {!currentIntegrity.valid && (
              <div className={styles.alertActions}>
                {/* Show break context checkbox */}
                <div className={styles.focusCheckboxWrapper}>
                  <Checkbox
                    id="showCompromised"
                    checked={showCompromisedOnly}
                    onCheckedChange={(checked) =>
                      handleShowCompromised(!!checked)
                    }
                    className={styles.focusCheckbox}
                    disabled={compromisedLoading}
                  />
                  <Label
                    htmlFor="showCompromised"
                    className={styles.focusLabel}
                  >
                    {compromisedLoading ? (
                      <span className={styles.scanningWrapper}>
                        <RefreshCcw className={styles.loadingIconSmall} />
                        Scanning...
                      </span>
                    ) : (
                      "FOCUS: Show break context"
                    )}
                  </Label>
                </div>

                {/* Force rescan from genesis checkbox — only visible when
                    show break context is checked */}
                {showCompromisedOnly && (
                  <div className={styles.rescanCheckboxWrapper}>
                    <Checkbox
                      id="forceRescan"
                      checked={forceRescan}
                      onCheckedChange={(checked) =>
                        handleForceRescanChange(!!checked)
                      }
                      className={styles.rescanCheckbox}
                      disabled={compromisedLoading}
                    />
                    <Label
                      htmlFor="forceRescan"
                      className={styles.rescanLabel}
                    >
                      <ScanSearch className={styles.rescanIcon} />
                      Rescan from genesis
                    </Label>
                  </div>
                )}

                <Button
                  size="sm"
                  className={styles.jumpButton}
                  onClick={jumpToBrokenBlock}
                >
                  <Search className={styles.jumpIcon} />
                  Jump to Block #{currentIntegrity.brokenAt}
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className={styles.statsGrid}>
        <Card>
          <CardHeader className={styles.cardHeaderSmall}>
            <CardTitle className={styles.cardTitleStats}>
              Search Ledger
            </CardTitle>
          </CardHeader>
          <CardContent className={styles.cardContentGrid2}>
            <div className={styles.searchInputs}>
              <Input
                placeholder="Hash..."
                value={searchHash}
                onChange={(e) => setSearchHash(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                className={styles.filterInput}
              />
              <Input
                placeholder="Seq #"
                value={searchSequence}
                onChange={(e) => setSearchSequence(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                className={styles.filterInput}
              />
            </div>
            <Input
              placeholder="Action (e.g. BALLOT_CAST)"
              value={searchAction}
              onChange={(e) => setSearchAction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              className={styles.filterInput}
            />
            <div className={styles.filterButtonRow}>
              <Button
                size="sm"
                onClick={onSearch}
                className={styles.searchSubmitBtn}
              >
                <Search className={styles.searchIconBtn} />
                Filter Results
              </Button>
              {hasActiveFilters && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearFilters}
                  className={styles.clearFilterBtn}
                  title="Clear all filters"
                >
                  <X className={styles.clearIconBtn} />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className={styles.cardHeaderSmall}>
            <CardTitle className={styles.cardTitleStats}>
              Integrity Filters
            </CardTitle>
          </CardHeader>
          <CardContent className={styles.integrityFilterList}>
            <div className={styles.integrityFilterToggle}>
              <Label
                htmlFor="showGaps"
                className={styles.integrityFilterLabel}
              >
                Highlight Sequence Gaps
              </Label>
              <Checkbox
                id="showGaps"
                checked={showSequenceGaps}
                onCheckedChange={(checked) => setShowSequenceGaps(!!checked)}
              />
            </div>
            <div className={styles.quickFilterRow}>
              <Button
                variant={activeAction === "BALLOT_CAST" ? "default" : "outline"}
                size="sm"
                className={`flex-1 text-[10px] h-8 font-bold transition-all ${
                  activeAction === "BALLOT_CAST"
                    ? styles.quickFilterActive
                    : styles.quickFilter
                }`}
                onClick={() => applyActionFilter("BALLOT_CAST")}
              >
                {activeAction === "BALLOT_CAST" && (
                  <span className={styles.quickFilterIconClose}>✕</span>
                )}
                Only Ballots
              </Button>
              <Button
                variant={
                  activeAction === "VOTING_FINALIZED" ? "default" : "outline"
                }
                size="sm"
                className={`flex-1 text-[10px] h-8 font-bold transition-all ${
                  activeAction === "VOTING_FINALIZED"
                    ? styles.quickFilterActive
                    : styles.quickFilter
                }`}
                onClick={() => applyActionFilter("VOTING_FINALIZED")}
              >
                {activeAction === "VOTING_FINALIZED" && (
                  <span className={styles.quickFilterIconClose}>✕</span>
                )}
                Only Finalized
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className={styles.cardHeaderSmall}>
            <CardTitle className={styles.cardTitleStats}>
              Live Chain Stats
            </CardTitle>
          </CardHeader>
          <CardContent className={styles.statsContent}>
            <div>
              <div className={styles.statsValuePrimary}>
                {showCompromisedOnly
                  ? compromisedBlocks.length
                  : filteredBlocks.length}
              </div>
              <p className={styles.statsLabel}>
                {showCompromisedOnly ? "Break Context" : "Loaded Blocks"}
              </p>
            </div>
            <div className="text-right">
              <div
                className={`${styles.statsValueSecondary} ${sequenceGaps.length > 0 ? styles.statsValueGap : styles.statsValueNoGap}`}
              >
                {sequenceGaps.length}
              </div>
              <p className={styles.statsLabel}>
                Detected Gaps
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={styles.ledgerCard}>
        <CardHeader className={styles.ledgerHeader}>
          <div className={styles.ledgerTitleWrapper}>
            <div>
              <CardTitle className={styles.ledgerTitle}>
                {showCompromisedOnly ? "Break Context" : "Scoped Ledger"}
              </CardTitle>
              <CardDescription>
                {showCompromisedOnly
                  ? "Tampered block and its immediate victim. Open each block to see the hash diff."
                  : "Independent cryptographic chain proving no ballots were tampered with for this voting."}
              </CardDescription>
            </div>
            {hasActiveFilters && (
              <Badge
                variant="secondary"
                className={styles.filterBadge}
              >
                Filtered
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className={styles.cardContentP0}>
          <div className={styles.tableWrapper}>
            <Table>
              <TableHeader className={styles.tableHeader}>
                <TableRow>
                  <TableHead className={`w-[160px] ${styles.tableHeadText}`}>
                    Voting Seq
                  </TableHead>
                  <TableHead className={`w-[120px] ${styles.tableHeadText}`}>
                    Global Seq
                  </TableHead>
                  <TableHead className={styles.tableHeadText}>
                    Action
                  </TableHead>
                  <TableHead className={styles.tableHeadText}>
                    Timestamp
                  </TableHead>
                  <TableHead className={`${styles.tableCellRight} ${styles.tableHeadText}`}>
                    Detail
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBlocks.map((rawBlock) => {
                  const role = getBreakRole(rawBlock);
                  const isTampered = role === "tampered";
                  const isVictim = role === "victim";
                  const isGap = isGapBlock(rawBlock.votingSequence);

                  let block = rawBlock;
                  if (role && !showCompromisedOnly && currentIntegrity) {
                    block = { ...rawBlock, __breakRole: role };
                    if (
                      role === "tampered" &&
                      currentIntegrity.errorType === "TAMPERED_HASH"
                    ) {
                      block.__corruptedHash = currentIntegrity.foundHash;
                      block.__expectedHash = currentIntegrity.expectedHash;
                    } else if (
                      role === "victim" &&
                      currentIntegrity.errorType === "TAMPERED_HASH"
                    ) {
                      block.__victimPrevHash =
                        block.votingPrevHash ?? block.prevHash;
                      block.__victimExpectedPrevHash =
                        currentIntegrity.expectedHash;
                    } else if (
                      role === "victim" &&
                      currentIntegrity.errorType === "BROKEN_LINK"
                    ) {
                      block.__victimPrevHash = currentIntegrity.foundPrevHash;
                      block.__victimExpectedPrevHash =
                        currentIntegrity.expectedPrevHash;
                    } else if (
                      role === "tampered" &&
                      currentIntegrity.errorType === "BROKEN_LINK"
                    ) {
                      block.__corruptedHash = block.hash;
                      block.__expectedHash = currentIntegrity.expectedPrevHash;
                    }
                  }

                  return (
                    <TableRow
                      key={block.sequence}
                      className={[
                        styles.tableRow,
                        isTampered ? styles.tamperedRow : "",
                        isVictim ? styles.victimRow : "",
                        isGap ? styles.gapRow : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <TableCell className={styles.seqCell}>
                        <div className={styles.seqCellWrapper}>
                          <span className={styles.votingSeqText}>
                            #{block.votingSequence}
                          </span>
                          {isTampered && (
                            <span className={styles.labelTampered}>
                              ● TAMPERED HASH
                            </span>
                          )}
                          {isVictim && (
                            <span className={styles.labelVictim}>
                              ↳ BROKEN LINK
                            </span>
                          )}
                          {isGap && (
                            <span className={styles.labelGap}>
                              ⚠ SEQUENCE GAP
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={styles.globalSeqCell}>
                        <Badge
                          variant="outline"
                          className={styles.globalSeqBadge}
                        >
                          G:{block.sequence}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={styles.actionBadge}
                        >
                          {block.action}
                        </Badge>
                      </TableCell>
                      <TableCell className={styles.timestampText}>
                        {format(
                          new Date(block.createdAt || 0),
                          "MMM d, HH:mm:ss",
                        )}
                      </TableCell>
                      <TableCell className={styles.tableCellRight}>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={styles.detailButton}
                            >
                              <Eye className={styles.eyeIcon} />
                            </Button>
                          </DialogTrigger>
                          <AuditBlockDetail block={block} type="voting" />
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {filteredBlocks.length === 0 && !compromisedLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className={styles.emptyStateText}
                    >
                      {showCompromisedOnly
                        ? "No compromised blocks found — the chain may be intact."
                        : "No audit blocks found for this voting."}
                    </TableCell>
                  </TableRow>
                )}

                {compromisedLoading && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className={styles.loadingWrapperFull}
                    >
                      <div className={styles.loadingStateWrapper}>
                        <RefreshCcw className={styles.loadingIconLarge} />
                        <span className={styles.loadingLabelLarge}>
                          {forceRescan
                            ? "Rescanning from genesis..."
                            : "Loading break context..."}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

}
