"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAudit } from "@/hooks/api/useAudit";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, ShieldAlert, Search, Hash, Clock, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function VerifyReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const { verifyReceipt } = useAudit();
  const [receiptHashes, setReceiptHashes] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !receiptHashes.trim()) return;

    // Split by comma or newline and trim
    const hashes = receiptHashes
      .split(/[\n,]+/)
      .map(h => h.trim())
      .filter(h => h.length > 0);

    if (hashes.length === 0) return;

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await verifyReceipt(id, hashes, "voting");
      if (response.data?.results) {
        setResults(response.data.results);
      } else {
        setError(response.error?.message || "Verification failed");
      }
    } catch (err) {
      setError("An unexpected error occurred during verification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container relative min-h-screen flex flex-col items-center py-12 px-4">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 max-w-2xl">
        <div className="flex flex-col space-y-2 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-blue-600" />
          <h1 className="text-3xl font-semibold tracking-tight">Verify Your Vote</h1>
          <p className="text-sm text-muted-foreground">
            Verify that your anonymous ballot was recorded correctly in the immutable audit chain.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Paste Receipt Hashes</CardTitle>
            <CardDescription>
              Enter one or more receipt hashes (separated by commas or new lines) to verify your ballots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onVerify} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">HMAC Hashes</label>
                <div className="relative">
                  <Textarea
                    placeholder="Paste your 64-character hashes here..."
                    className="font-mono text-xs min-h-[120px]"
                    value={receiptHashes}
                    onChange={(e) => setReceiptHashes(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !receiptHashes.trim()}>
                {loading ? "Verifying..." : "Verify Receipts"}
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
              {error}. Please check your Receipt Hashes.
            </AlertDescription>
          </Alert>
        )}

        {results && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
               Verification Results ({results.length})
            </h2>
            {results.map((result, idx) => (
              <Card key={idx} className={result.found ? "border-emerald-500 bg-emerald-50/5" : "border-red-500 bg-red-50/5"}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-sm flex items-center gap-2 ${result.found ? 'text-emerald-600' : 'text-red-600'}`}>
                      {result.found ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {result.found ? "Proof of Inclusion Found" : "Hash Not Found"}
                    </CardTitle>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded text-white ${result.found ? 'bg-emerald-500' : 'bg-red-500'}`}>
                      {result.found ? 'VERIFIED' : 'NOT FOUND'}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground break-all mt-1">
                    {result.hash}
                  </p>
                </CardHeader>
                {result.found && (
                  <CardContent className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Sequence</span>
                        <p className="text-lg font-bold font-mono">#{result.sequence}</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Timestamp</span>
                        <div className="flex items-center justify-end text-xs font-medium">
                          <Clock className="mr-1 h-3 w-3" />
                          {(() => {
                            const d = new Date(result.timestamp);
                            return !isNaN(d.getTime()) ? format(d, "MMM d, HH:mm:ss") : "Invalid Time";
                          })()}
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
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <code className="text-[10px] font-mono text-muted-foreground">
                          {result.prevHash.slice(0, 32)}...
                        </code>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
