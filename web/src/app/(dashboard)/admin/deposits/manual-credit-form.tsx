"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { UserCombobox } from "@/components/admin/user-combobox";
import { manualCreditDeposit } from "./actions";

export type CreditAsset = { symbol: string; name: string; networks: string[] };

/**
 * The dropdowns are conveniences over the same field names the server action always validated
 * (email / assetSymbol / network / amount / note) — the money path is unchanged; the UI just makes
 * invalid combinations unpickable. Network options follow the selected asset.
 */
export function ManualCreditForm({
  assets,
  initialEmail = "",
}: {
  assets: CreditAsset[];
  initialEmail?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [symbol, setSymbol] = useState(assets[0]?.symbol ?? "");

  const networks = useMemo(
    () => assets.find((a) => a.symbol === symbol)?.networks ?? [],
    [assets, symbol],
  );

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">User</Label>
          <UserCombobox id="email" name="email" defaultValue={initialEmail} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" name="amount" inputMode="decimal" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assetSymbol">Coin</Label>
          <SelectNative
            id="assetSymbol"
            name="assetSymbol"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            required
          >
            {assets.map((a) => (
              <option key={a.symbol} value={a.symbol}>
                {a.symbol} — {a.name}
              </option>
            ))}
          </SelectNative>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="network">Network</Label>
          {/* key remount resets the browser's selection when the coin changes */}
          <SelectNative id="network" name="network" key={symbol} required>
            {networks.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </SelectNative>
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
        <p role="alert" className={`text-sm ${message.ok ? "text-primary" : "text-danger"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
