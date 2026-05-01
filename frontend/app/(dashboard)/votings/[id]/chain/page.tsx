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
  Link as LinkIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { useI18n } from "@/lib/i18n/context";

export default function VotingChainExplorerPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { blocks, loading, integrity, fetchVotingChain, verifyScopedIntegrity } = useAudit();
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

  const filteredBlocks = blocks.filter(b => 
    b.action.toLowerCase().includes(search.toLowerCase()) ||
    b.hash.includes(search) ||
    JSON.stringify(b.payload).includes(search)
  );

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.votings, href: "/votings" },
    { label: id.slice(0, 8), href: `/votings/${id}` },
    { label: "Audit Chain" },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <Breadcrumbs items={breadcrumbs} />

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Voting Audit Chain</h1>
          <p className="text-muted-foreground">
            Immutable cryptographic sub-chain for voting {id}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => verifyScopedIntegrity("voting", id)}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Verify Chain
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Chain Integrity</CardTitle>
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
                    <ShieldAlert className="mr-1 h-3 w-3" /> Compromised
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
            <CardTitle className="text-sm font-medium">Search Within Sub-chain</CardTitle>
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
            Independent cryptographic chain proving no ballots were tampered with for this voting.
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
                  <TableRow key={block.sequence}>
                    <TableCell className="font-mono font-bold text-emerald-600">
                      #{block.votingSequence}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      #{block.sequence}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {block.action}
                      </Badge>
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
                              Block #{block.votingSequence} Details
                            </DialogTitle>
                            <DialogDescription className="font-mono text-[10px] break-all flex flex-col gap-2 pt-2">
                              <div>
                                <span className="font-bold text-emerald-600 mr-2">VOTING HASH:</span>
                                {block.hash}
                              </div>
                              <div>
                                <span className="font-bold text-muted-foreground mr-2">VOTING PREV:</span>
                                {block.votingPrevHash || "GENESIS"}
                              </div>
                              <div className="border-t pt-2 mt-2 opacity-60">
                                <span className="font-bold mr-2">GLOBAL HASH:</span>
                                {block.hash}
                              </div>
                              <div className="opacity-60">
                                <span className="font-bold mr-2">GLOBAL PREV:</span>
                                {block.prevHash}
                              </div>
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
                {filteredBlocks.length === 0 && (
                   <TableRow>
                     <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
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
