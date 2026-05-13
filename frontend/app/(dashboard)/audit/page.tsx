"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAudit } from "@/hooks/api/useAudit";
import { useVotings } from "@/hooks/api/useVotings";
import { useSurveys } from "@/hooks/api/useSurveys";
import { useAuth } from "@/lib/auth/context";
import { TTL_ACTIONS } from "@/types/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useI18n } from "@/lib/i18n/context";
import {
  ShieldCheck,
  ShieldAlert,
  Eye,
  RefreshCcw,
  Database,
  User,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import styles from "./page.module.css";

export default function AuditExplorerPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const {
    blocks,
    loading,
    integrity,
    fetchGlobalChain,
    verifyScopedIntegrity,
  } = useAudit();
  const { votings, fetchVotings, loading: votingsLoading } = useVotings();
  const { surveys, fetchSurveys, loading: surveysLoading } = useSurveys();

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");

  // Filters
  const [showVotings, setShowVotings] = useState(true);
  const [showSurveys, setShowSurveys] = useState(true);
  const [groupFilter, setGroupFilter] = useState("");

  const isAuthorized = user?.role === "admin" || user?.role === "auditor";

  useEffect(() => {
    fetchVotings({ isOpen: true });
    fetchSurveys({ isOpen: true });
    if (isAuthorized) {
      fetchGlobalChain(page, pageSize);
    }
  }, [
    page,
    pageSize,
    fetchGlobalChain,
    fetchVotings,
    fetchSurveys,
    isAuthorized,
  ]);

  const onRefresh = () => {
    fetchGlobalChain(page, pageSize);
    verifyScopedIntegrity();
  };

  const filteredBlocks = blocks.filter(
    (b) =>
      b.action.toLowerCase().includes(search.toLowerCase()) ||
      b.hash.includes(search) ||
      b.votingId?.includes(search) ||
      b.userId?.includes(search),
  );

  const filteredChains = useMemo(() => {
    const list = [
      ...(showVotings
        ? votings
            .filter((v) => v.isOpen)
            .map((v) => ({
              id: v.id,
              title: v.title,
              type: "Voting",
              groupId: v.groupId,
            }))
        : []),
      ...(showSurveys
        ? surveys
            .filter((s) => s.isOpen)
            .map((s) => ({
              id: s.id,
              title: s.title,
              type: "Survey",
              groupId: s.groupId,
            }))
        : []),
    ];
    return groupFilter
      ? list.filter((item) => item.groupId.includes(groupFilter))
      : list;
  }, [votings, surveys, showVotings, showSurveys, groupFilter]);

  // A block is "broken" when it is the exact sequence where the chain breaks.
  const isBrokenBlock = (seq: number) =>
    integrity != null && !integrity.valid && integrity.brokenAt === seq;

  return (
    <div className={styles.page}>
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t.audit.title}</h1>
        <p className="text-muted-foreground mt-2">{t.audit.subtitle}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>{t.common.filter}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showVotings"
                  checked={showVotings}
                  onCheckedChange={(checked) => setShowVotings(!!checked)}
                />
                <Label htmlFor="showVotings">{t.audit.filterVotings}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showSurveys"
                  checked={showSurveys}
                  onCheckedChange={(checked) => setShowSurveys(!!checked)}
                />
                <Label htmlFor="showSurveys">{t.audit.filterSurveys}</Label>
              </div>
            </div>
            <Input
              placeholder={t.audit.searchPlaceholder}
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.audit.publicAudits}</CardTitle>
        </CardHeader>
        <CardContent>
          {votingsLoading || surveysLoading ? (
            <p className="text-sm text-muted-foreground">{t.common.loading}</p>
          ) : (
            <div className="grid gap-2">
              {filteredChains.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded border border-muted-foreground/20 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() =>
                    router.push(
                      `/audit/${item.type.toLowerCase()}s/audit-chain/${item.id}`,
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{item.type}</Badge>
                    <span className="text-sm font-medium">{item.title}</span>
                  </div>
                  <Button variant="ghost" size="sm">
                    {t.audit.viewDetails}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isAuthorized && (
        <>
          {integrity && (
            <Alert
              variant={integrity.valid ? "default" : "destructive"}
              className="mb-4"
            >
              <div className="flex items-center gap-2">
                {integrity.valid ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                <AlertTitle
                  className={
                    integrity.valid ? "" : "font-bold text-red-600 uppercase"
                  }
                >
                  {integrity.valid
                    ? "Chain Integrity Status: Valid"
                    : "Chain Integrity Status: COMPROMISED"}
                </AlertTitle>
              </div>
              <AlertDescription>
                {integrity.valid
                  ? `Verified ${integrity.totalChecked} blocks. All links are secure.`
                  : `Break detected at sequence #${integrity.brokenAt}. Reason: ${integrity.reason}`}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between mt-8">
            <h2 className="text-xl font-bold">Administrative Audit Explorer</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCcw
                  className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  verifyScopedIntegrity("global", undefined, false)
                }
                disabled={loading}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Verify
              </Button>
              <Button
                size="sm"
                onClick={() => verifyScopedIntegrity("global", undefined, true)}
                disabled={loading}
              >
                <ShieldAlert className="mr-2 h-4 w-4" />
                Deep Verify
              </Button>
            </div>
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Unified Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Seq</TableHead>
                      <TableHead>{t.audit.action}</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>{t.audit.timestamp}</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBlocks.map((block) => (
                      <TableRow
                        key={block.sequence}
                        className={
                          isBrokenBlock(block.sequence) ? styles.brokenRow : ""
                        }
                      >
                        <TableCell className="font-mono font-bold text-blue-500">
                          #{block.sequence}
                          {isBrokenBlock(block.sequence) && (
                            <span className={styles.brokenBadge}>● BROKEN</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              TTL_ACTIONS.includes(block.action as any)
                                ? "default"
                                : "secondary"
                            }
                            className="font-mono text-[10px]"
                          >
                            {block.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {block.votingId && (
                              <span className="flex items-center text-[10px] text-muted-foreground">
                                Voting: {block.votingId.slice(0, 8)}...
                              </span>
                            )}
                            {block.surveyId && (
                              <span className="flex items-center text-[10px] text-muted-foreground">
                                Survey: {block.surveyId.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {block.userId ? (
                            <div className="flex items-center text-[10px]">
                              <User className="h-3 w-3 mr-1" />{" "}
                              {block.userId.slice(0, 8)}...
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">
                              Anonymous
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(block.createdAt), "MMM d, HH:mm:ss")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className={styles.dialogContent}>
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <Database className="h-5 w-5" />
                                  {`Block #${block.sequence} ${t.audit.details}`}
                                </DialogTitle>
                                <DialogDescription className={styles.hashValue}>
                                  Hash: {block.hash}
                                  <br />
                                  Prev: {block.prevHash}
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
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
