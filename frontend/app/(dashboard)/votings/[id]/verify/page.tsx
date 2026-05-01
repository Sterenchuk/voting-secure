"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/hooks/api/useApi";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";

interface VerifyResult {
  found: boolean;
  sequence?: number;
  blockHash?: string;
  prevHash?: string;
}

export default function VerifyReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [hash, setHash] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!hash.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const response = await api.get<VerifyResult>(
      `/votings/${id}/verify-receipt?hash=${encodeURIComponent(hash.trim())}`,
    );

    if (response.data) {
      setResult(response.data);
    } else {
      setError(response.error?.message ?? "Verification failed");
    }

    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem' }}>
      <h1>Verify Your Vote</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>
        Paste a ballot receipt hash to verify it exists
        in the public audit chain.
      </p>

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label>
            <strong>Receipt Hash</strong>
            <textarea
              rows={3}
              style={{
                width: '100%',
                fontFamily: 'monospace',
                fontSize: '12px',
                padding: '8px',
                marginTop: '4px',
                borderRadius: '4px',
                border: '1px solid var(--color-border)',
                resize: 'vertical',
              }}
              placeholder="Paste your HMAC receipt hash here..."
              value={hash}
              onChange={(e) => setHash(e.target.value)}
            />
          </label>

          <Button onClick={handleVerify} disabled={!hash.trim() || loading} loading={loading}>
            Verify Receipt
          </Button>
        </div>

        {/* Result */}
        {result && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            borderRadius: '6px',
            background: result.found
              ? 'var(--color-success-bg, #e6f9f0)'
              : 'var(--color-error-bg, #fef2f2)',
            border: `1px solid ${result.found ? 'var(--color-success)' : 'var(--color-error)'}`,
          }}>
            {result.found ? (
              <>
                <h3 style={{ color: 'var(--color-success)', margin: '0 0 0.5rem' }}>
                  ✓ Receipt verified — vote was counted
                </h3>
                <table style={{ fontSize: '12px', width: '100%' }}>
                  <tbody>
                    <tr>
                      <td style={{ color: 'var(--color-text-muted)', paddingRight: '1rem' }}>
                        Chain sequence
                      </td>
                      <td><code>#{result.sequence}</code></td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--color-text-muted)', paddingRight: '1rem' }}>
                        Block hash
                      </td>
                      <td>
                        <code style={{ wordBreak: 'break-all' }}>
                          {result.blockHash}
                        </code>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--color-text-muted)', paddingRight: '1rem' }}>
                        Previous hash
                      </td>
                      <td>
                        <code style={{ wordBreak: 'break-all' }}>
                          {result.prevHash}
                        </code>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                  This receipt appears in block #{result.sequence} of the
                  immutable audit chain. The vote cannot be altered without
                  breaking the chain.
                </p>
              </>
            ) : (
              <>
                <h3 style={{ color: 'var(--color-error)', margin: '0 0 0.5rem' }}>
                  ✗ Receipt not found
                </h3>
                <p style={{ fontSize: '14px', margin: 0 }}>
                  This hash does not exist in the audit chain for this voting.
                  Check that you copied the full receipt hash correctly.
                </p>
              </>
            )}
          </div>
        )}

        {error && (
          <p style={{ color: 'var(--color-error)', marginTop: '1rem' }}>
            {error}
          </p>
        )}
      </Card>

      <div style={{ marginTop: '1rem' }}>
        <a href={`/votings/${id}`} style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
          ← Back to voting
        </a>
      </div>
    </div>
  );
}
