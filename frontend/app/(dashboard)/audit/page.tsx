"use client";

import { useEffect, useState } from "react";
import { useAudit, AuditLogEntry } from "@/hooks/api/useAudit";
import { TTL_ACTIONS } from "@/types/audit";
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
  ExternalLink,
  ChevronRight,
  Database,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AuditExplorerPage() {
  const { blocks, totalCount, loading, integrity, fetchGlobalChain, verifyScopedIntegrity } = useAudit();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchGlobalChain(page, pageSize);
  }, [page, pageSize, fetchGlobalChain]);

  const onRefresh = () => {
    fetchGlobalChain(page, pageSize);
    verifyScopedIntegrity();
  };

  const filteredBlocks = blocks.filter(b => 
    b.action.toLowerCase().includes(search.toLowerCase()) ||
    b.hash.includes(search) ||
    b.votingId?.includes(search) ||
    b.userId?.includes(search)
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Explorer</h1>
          <p className="text-muted-foreground">
            Monitor the immutable cryptographic ledger of all platform actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Chain
          </Button>
          <Button size="sm" onClick={() => verifyScopedIntegrity()}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Verify Integrity
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Chain Status</CardTitle>
          </CardHeader>
          <CardContent>
            {integrity ? (
              <div className="flex items-center gap-2">
                {integrity.valid ? (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600">
                    <ShieldCheck className="mr-1 h-3 w-3" /> Secure
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <ShieldAlert className="mr-1 h-3 w-3" /> Broken
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {integrity.totalChecked} checked
                </span>
              </div>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Click Verify
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Blocks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Search Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search action, ID, or hash..."
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
          <CardTitle>Unified Audit Log</CardTitle>
          <CardDescription>
            One hash chain linking all platform activity for complete accountability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Seq</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBlocks.map((block) => (
                  <TableRow key={block.sequence}>
                    <TableCell className="font-mono font-bold text-blue-500">
                      #{block.sequence}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TTL_ACTIONS.includes(block.action as any) ? "default" : "secondary"} className="font-mono text-[10px]">
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
                        {block.groupId && (
                          <span className="flex items-center text-[10px] text-muted-foreground">
                             Group: {block.groupId.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {block.userId ? (
                        <div className="flex items-center text-[10px]">
                           <User className="h-3 w-3 mr-1" /> {block.userId.slice(0, 8)}...
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">Anonymous</span>
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
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <Database className="h-5 w-5" />
                              Block #{block.sequence} Details
                            </DialogTitle>
                            <DialogDescription className="font-mono text-[10px] break-all">
                              Hash: {block.hash}<br/>
                              Prev: {block.prevHash}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="mt-4">
                            <ScrollArea className="h-[300px] w-full rounded border bg-muted p-4">
                                <pre className="text-xs leading-relaxed">
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
    </div>
  );
}
