"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { approveDepositClaim, rejectDepositClaim } from "./actions";

export type ClaimRow = {
  id: string;
  email: string;
  symbol: string;
  network: string;
  amount: string;
  txHash: string | null;
  fromAddress: string | null;
  createdAt: string;
};

// A user-submitted claim is a synthetic txid (prefixed "claim:") when no real txid was given —
// show a dash rather than the internal key.
function displayTx(txHash: string | null): string | null {
  if (!txHash || txHash.startsWith("claim:")) return null;
  return txHash;
}

export function ClaimQueue({ claims }: { claims: ClaimRow[] }) {
  if (claims.length === 0) {
    return <p className="text-sm text-foreground-muted">No deposit claims awaiting review.</p>;
  }
  return (
    <div className="flex flex-col divide-y divide-border-subtle">
      {claims.map((c) => (
        <ClaimItem key={c.id} claim={c} />
      ))}
    </div>
  );
}

function ClaimItem({ claim }: { claim: ClaimRow }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const tx = displayTx(claim.txHash);

  // Same pattern as manual-credit-form: a <form action> submits FormData to the server action,
  // wrapped in a transition so we can surface an inline error and a pending state.
  function submit(fn: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await fn(fd);
      if (!r.ok) setError(r.error ?? "Action failed");
    });
  }

  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-base font-semibold tabular-nums">
            {claim.amount} {claim.symbol}
          </span>
          <span className="text-sm text-foreground-muted">{claim.email}</span>
          <span className="rounded-full border border-border-subtle px-2 py-0.5 text-xs font-mono text-foreground-muted">
            {claim.network}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-foreground-muted">
          <span>{claim.createdAt}</span>
          {tx ? (
            <span className="min-w-0 break-all font-mono">tx: {tx}</span>
          ) : (
            <span className="text-warning">no transaction ID provided</span>
          )}
          {claim.fromAddress && (
            <span className="min-w-0 break-all font-mono">from: {claim.fromAddress}</span>
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <form action={(fd) => submit(rejectDepositClaim, fd)}>
          <input type="hidden" name="depositId" value={claim.id} />
          <input type="hidden" name="reason" value="Payment not received / could not be verified" />
          <Button type="submit" size="sm" variant="outline" disabled={isPending}>
            <X className="size-4" />
            Reject
          </Button>
        </form>
        <form action={(fd) => submit(approveDepositClaim, fd)}>
          <input type="hidden" name="depositId" value={claim.id} />
          <Button type="submit" size="sm" disabled={isPending}>
            <Check className="size-4" />
            {isPending ? "Working…" : "Approve & credit"}
          </Button>
        </form>
      </div>
    </div>
  );
}
