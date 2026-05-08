"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSurveys } from "@/hooks/api/useSurveys";
import { useAudit } from "@/hooks/api/useAudit";
import { useI18n } from "@/lib/i18n/context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  ArrowLeft,
  Calendar,
  Hash,
  Database,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export default function SurveyReceiptVerifyPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();
  const { currentSurvey, fetchSurvey } = useSurveys();
  const { verifyReceipt } = useAudit();

  const [receiptHash, setReceiptHash] = useState(searchParams.get("hash") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchSurvey(id);
  }, [id, fetchSurvey]);

  useEffect(() => {
    if (searchParams.get("hash")) {
      handleVerify(searchParams.get("hash")!);
    }
  }, [searchParams]);

  const handleVerify = async (hashToVerify?: string) => {
    const hash = hashToVerify || receiptHash;
    if (!hash) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Use the specific survey verification endpoint
      const res = await api.get<any>(`/surveys/${id}/verify-receipt?hash=${encodeURIComponent(hash)}`);
      if (res.data) {
        setResult(res.data);
      } else {
        setError("Receipt not found in the audit chain.");
      }
    } catch (err) {
      setError("Failed to verify receipt. Please check the hash and try again.");
    } finally {
      setLoading(false);
    }
  };

  const breadcrumbs = [
    { label: t.common.dashboard, href: "/dashboard" },
    { label: t.common.surveys, href: "/surveys" },
    { label: currentSurvey?.title || "Survey", href: `/surveys/${id}` },
    { label: "Verify Response" },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <Breadcrumbs items={breadcrumbs} />

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Verify My Response</h1>
          <p className="text-muted-foreground">
            Cryptographic proof that your survey choices were recorded as cast.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Receipt Lookup</CardTitle>
            <CardDescription>
              Enter the receipt hash from your JSON download or email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Receipt Hash</label>
              <div className="flex gap-2">
                <Input
                  placeholder="sha256:..."
                  value={receiptHash}
                  onChange={(e) => setReceiptHash(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  size="icon"
                  onClick={() => handleVerify()}
                  disabled={loading || !receiptHash}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Verification ensures your specific response exists within the 
              immutable audit sub-chain for this survey.
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Verification Result</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
              </div>
            ) : result ? (
              <div className="space-y-6">
                {result.found ? (
                  <>
                    <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 p-4 border border-emerald-500/20">
                      <ShieldCheck className="h-8 w-8 text-emerald-500" />
                      <div>
                        <h4 className="font-bold text-emerald-700">Receipt Verified</h4>
                        <p className="text-sm text-emerald-600/80">
                          This ballot was found in the audit chain and is cryptographically secure.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                          <Database className="h-3 w-3" /> Audit Sequence
                        </span>
                        <p className="font-mono font-bold">#{result.sequence}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Timestamp
                        </span>
                        <p className="text-sm">
                          {format(new Date(result.timestamp), "PPP p")}
                        </p>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                          <Hash className="h-3 w-3" /> Block Hash
                        </span>
                        <p className="font-mono text-[10px] break-all bg-muted p-2 rounded border">
                          {result.blockHash}
                        </p>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Previous Block Reference
                        </span>
                        <p className="font-mono text-[10px] break-all text-muted-foreground">
                          {result.prevHash}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                       <Button 
                         variant="outline" 
                         size="sm" 
                         onClick={() => router.push(`/audit/surveys/audit-chain/${id}`)}
                       >
                         View Full Audit Chain
                       </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <ShieldAlert className="h-12 w-12 text-destructive mb-2" />
                    <h4 className="font-bold">Receipt Not Found</h4>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      The provided hash does not match any ballot in this survey's audit chain. 
                      Please verify the hash or contact an administrator.
                    </p>
                  </div>
                )}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-destructive">
                <ShieldAlert className="h-12 w-12 mb-2" />
                <p className="font-medium">{error}</p>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground italic">
                Enter a hash to begin verification...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper to use api in client component if not imported
import { api } from "@/hooks/api/useApi";
