"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAudit } from "@/hooks/api/useAudit";
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
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  Eye,
  RefreshCcw,
  Database,
} from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useI18n } from "@/lib/i18n/context";
import styles from "./page.module.css";

export default function VotingChainExplorerPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const {
    blocks,
    loading,
    integrity,
    fetchVotingChain,
    verifyScopedIntegrity,
  } = useAudit();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (id) {
      fetchVotingChain(id);
    }
  }, [id, fetchVotingChain]);

  const onRefresh = () => {
    if (id) {
      fetchVotingChain(id);
      verifyScopedIntegrity("voting", id);
    }
  };

  const filteredBlocks = blocks.filter(
    (b) =>
      b.action.toLowerCase().includes(search.toLowerCase()) ||
      b.hash.includes(search) ||
      JSON.stringify(b.payload).includes(search),
  );

  // Compare against votingSequence — integrity.brokenAt is scoped to this chain.
  const isBrokenBlock = (votingSeq: number | null | undefined) =>
    integrity != null && !integrity.valid && integrity.brokenAt === votingSeq;

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: "Audit Hub", href: "/audit" },
    { label: id.slice(0, 8), href: `/audit/votings/${id}` },
    { label: "Audit Chain" },
  ];

  return (
    <div className={styles.surveyPage}>
      <Breadcrumbs items={breadcrumbs} />

      <div className={styles.surveyPageHeader}>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Voting Audit Chain
          </h1>
          <p className="text-muted-foreground">
            Immutable cryptographic sub-chain for voting {id}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className={styles.actionButton}
          >
            <RefreshCcw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => verifyScopedIntegrity("voting", id)}
            className={`border-primary/50 ${styles.actionButton}`}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Verify Chain
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Chain Integrity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {integrity ? (
              <div className="flex items-center gap-2">
                {integrity.valid ? (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600">
                    <ShieldCheck className="mr-1 h-3 w-3" /> Secure
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="animate-pulse">
                    <ShieldAlert className="mr-1 h-3 w-3" />
                    <span className="font-bold text-red-600">COMPROMISED</span>
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {integrity.totalChecked} blocks
                </span>
              </div>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not Verified
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Block Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blocks.length}</div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Search Within Sub-chain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search action or hash..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scoped Ledger</CardTitle>
          <CardDescription>
            Independent cryptographic chain proving no ballots were tampered
            with for this voting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Voting Seq</TableHead>
                  <TableHead className="w-[100px]">Global Seq</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBlocks.map((block) => (
                  <TableRow
                    key={block.sequence}
                    className={
                      isBrokenBlock(block.votingSequence)
                        ? styles.brokenRow
                        : ""
                    }
                  >
                    <TableCell className={styles.seqCell}>
                      #{block.votingSequence}
                      {isBrokenBlock(block.votingSequence) && (
                        <span className={styles.brokenBadge}>● BROKEN</span>
                      )}
                    </TableCell>
                    <TableCell className={styles.globalSeqCell}>
                      #{block.sequence}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="font-mono text-[10px]"
                      >
                        {block.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(
                        new Date(block.createdAt || 0),
                        "MMM d, HH:mm:ss",
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className={styles.dialogContent}>
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Database className="h-5 w-5" />
                              Block #{block.votingSequence} Details
                            </DialogTitle>
                            <DialogDescription
                              className={styles.surveyHashBlock}
                            >
                              <span>
                                <span className={styles.surveyHashLabel}>
                                  VOTING HASH:
                                </span>
                                {block.hash}
                              </span>
                              <span>
                                <span className={styles.surveyHashLabelMuted}>
                                  VOTING PREV:
                                </span>
                                {block.votingPrevHash || "GENESIS"}
                              </span>
                              <span className={styles.surveyHashSeparator}>
                                <span className="font-bold mr-2">
                                  GLOBAL HASH:
                                </span>
                                {block.hash}
                              </span>
                              <span className="opacity-60">
                                <span className="font-bold mr-2">
                                  GLOBAL PREV:
                                </span>
                                {block.prevHash}
                              </span>
                            </DialogDescription>
                          </DialogHeader>
                          <div className="mt-4">
                            <ScrollArea className={styles.scrollArea}>
                              <pre className={styles.payloadPre}>
                                {JSON.stringify(block.payload, null, 2)}
                              </pre>
                            </ScrollArea>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredBlocks.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground italic"
                    >
                      No audit blocks found for this voting.
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
