"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  addWhitelistAddress,
  removeWhitelistAddress,
  setWhitelistOnly,
} from "./actions";

type Entry = { id: string; label: string; network: string; address: string; memo: string | null };

export function WhitelistSection({
  entries,
  whitelistOnly,
}: {
  entries: Entry[];
  whitelistOnly: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [only, setOnly] = useState(whitelistOnly);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-2">
        <Checkbox
          id="whitelistOnly"
          checked={only}
          onCheckedChange={(checked) => {
            const val = checked === true;
            setOnly(val);
            startTransition(() => {
              void setWhitelistOnly(val);
            });
          }}
          className="mt-0.5"
        />
        <Label htmlFor="whitelistOnly" className="text-sm font-normal text-foreground-muted">
          Only allow withdrawals to whitelisted addresses. Strongly recommended — blocks
          withdrawals to any address not listed below.
        </Label>
      </div>

      {entries.length > 0 && (
        <div className="flex flex-col gap-2">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-sm border border-border-subtle bg-surface px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{e.label}</span>
                  <span className="rounded-xs bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-foreground-muted">
                    {e.network}
                  </span>
                </div>
                <div className="truncate font-mono text-xs text-foreground-muted">
                  {e.address}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  startTransition(() => {
                    void removeWhitelistAddress(e.id);
                  })
                }
                aria-label={`Remove ${e.label}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <form
        action={(fd) => {
          setError(null);
          startTransition(async () => {
            const res = await addWhitelistAddress(fd);
            if (!res.ok) setError(res.error);
          });
        }}
        className="flex flex-col gap-3 border-t border-border-subtle pt-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wl-label">Label</Label>
            <Input id="wl-label" name="label" placeholder="e.g. My Ledger" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wl-network">Network</Label>
            <Input id="wl-network" name="network" placeholder="e.g. BTC_TESTNET" required />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wl-address">Address</Label>
          <Input id="wl-address" name="address" className="font-mono text-sm" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wl-memo">Memo / tag (optional)</Label>
          <Input id="wl-memo" name="memo" />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button type="submit" variant="secondary" className="w-fit" disabled={isPending}>
          Add address
        </Button>
      </form>
    </div>
  );
}
