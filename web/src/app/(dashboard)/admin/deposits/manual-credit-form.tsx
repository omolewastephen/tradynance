"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { manualCreditDeposit } from "./actions";

export function ManualCreditForm() {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      action={(formData) => {
        setMessage(null);
        startTransition(async () => {
          const result = await manualCreditDeposit(formData);
          setMessage(
            result.ok
              ? { ok: true, text: `Credited. New balance: ${result.newBalance}` }
              : { ok: false, text: result.error },
          );
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">User email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" name="amount" inputMode="decimal" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assetSymbol">Asset (e.g. BTC)</Label>
          <Input id="assetSymbol" name="assetSymbol" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="network">Network (e.g. BTC_TESTNET)</Label>
          <Input id="network" name="network" required />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" name="note" />
      </div>
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Crediting…" : "Credit deposit"}
      </Button>
      {message && (
        <p className={`text-sm ${message.ok ? "text-primary" : "text-danger"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
