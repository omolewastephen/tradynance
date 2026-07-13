"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimDeposit } from "./actions";

export function ClaimForm({
  assetSymbol,
  network,
  toAddress,
}: {
  assetSymbol: string;
  network: string;
  toAddress: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  if (result?.ok) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary-muted px-4 py-3 text-sm">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-foreground">{result.text}</p>
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        setResult(null);
        startTransition(async () => {
          const r = await claimDeposit(formData);
          setResult(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
        });
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="assetSymbol" value={assetSymbol} />
      <input type="hidden" name="network" value={network} />
      <input type="hidden" name="toAddress" value={toAddress} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="claim-amount">Amount sent ({assetSymbol})</Label>
          <Input id="claim-amount" name="amount" inputMode="decimal" placeholder="0.00" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="claim-tx">
            Transaction ID / hash <span className="text-foreground-subtle">(recommended)</span>
          </Label>
          <Input id="claim-tx" name="txHash" placeholder="e.g. 0x… or a blockchain txid" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="claim-from">
          Sending address <span className="text-foreground-subtle">(optional)</span>
        </Label>
        <Input id="claim-from" name="fromAddress" placeholder="The wallet you sent from" />
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending} className="w-fit">
          {isPending ? "Submitting…" : "I've made this deposit"}
        </Button>
        {result && !result.ok && <p className="text-sm text-danger">{result.text}</p>}
      </div>

      <p className="text-xs text-foreground-muted">
        Including the transaction ID lets us match your payment to your account faster. Your balance
        updates once an admin confirms the funds arrived.
      </p>
    </form>
  );
}
