"use client";

import { useState } from "react";
import { useAudit } from "@/hooks/api/useAudit";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Hash,
  Clock,
  ExternalLink,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ReceiptVerifierPage() {
  const { verifyReceipt } = useAudit();
  const [votingId, setVotingId] = useState("");
  const [receiptHash, setReceiptHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!votingId || !receiptHash) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await verifyReceipt(votingId, receiptHash);
      if (response.data) {
        setResult(response.data);
      } else {
        setError(response.error?.message || "Receipt not found in audit chain");
      }
    } catch (err) {
      setError("An unexpected error occurred during verification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-1 lg:px-0">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[550px] p-8">
        <div className="flex flex-col space-y-2 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-blue-600" />
          <h1 className="text-3xl font-semibold tracking-tight">Receipt Verifier</h1>
          <p className="text-sm text-muted-foreground">
            Verify that your anonymous ballot was recorded correctly in the immutable audit chain.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Verify Your Vote</CardTitle>
            <CardDescription>
              Enter the details from your digital receipt to locate your block.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onVerify} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Voting ID</label>
                <div className="relative">
                  <ChevronRight className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                    className="pl-8"
                    value={votingId}
                    onChange={(e) => setVotingId(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Receipt HMAC Hash</label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Paste your 64-character hash here..."
                    className="pl-8 font-mono text-xs"
                    value={receiptHash}
                    onChange={(e) => setReceiptHash(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verifying..." : "Verify Receipt"}
                {!loading && <Search className="ml-2 h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Verification Failed</AlertTitle>
            <AlertDescription className="text-xs">
              {error}. Please check your Voting ID and Receipt Hash.
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <Card className="border-emerald-500 bg-emerald-50/10">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-emerald-600 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Proof of Inclusion Found
                </CardTitle>
                <span className="text-[10px] font-mono bg-emerald-500 text-white px-2 py-0.5 rounded">
                  VERIFIED
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Sequence</span>
                  <p className="text-xl font-bold font-mono">#{result.chainSequence}</p>
                </div>
                <div className="space-y-1 text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Timestamp</span>
                  <div className="flex items-center justify-end text-xs font-medium">
                    <Clock className="mr-1 h-3 w-3" />
                    {format(new Date(result.timestamp), "MMM d, HH:mm:ss")}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Block Hash</span>
                <div className="rounded bg-muted p-2">
                  <code className="text-[10px] break-all font-mono">
                    {result.blockHash}
                  </code>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Previous Link</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <code className="text-[10px] font-mono text-muted-foreground">
                    {result.prevHash.slice(0, 32)}...
                  </code>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Button variant="outline" className="w-full text-xs" asChild>
                  <a href={`/votings/${votingId}/chain?search=${result.blockHash}`} target="_blank" rel="noreferrer">
                    View in Voting Chain Explorer
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </a>
                </Button>
                <Button variant="ghost" className="w-full text-xs text-muted-foreground" asChild>
                  <a href={`/dashboard/audit?search=${result.blockHash}`} target="_blank" rel="noreferrer">
                    View in Global Audit Log
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="px-8 text-center text-xs text-muted-foreground leading-relaxed">
          The "Truth Triangle" ensures that no vote can be deleted or modified without breaking the cryptographic chain. Anyone can download the full chain to independently verify the integrity of the results.
        </p>
      </div>
    </div>
  );
}
