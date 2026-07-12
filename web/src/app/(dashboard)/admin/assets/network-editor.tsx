"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { updateAssetNetwork } from "./actions";

export type NetworkVM = {
  id: string;
  network: string;
  depositAddress: string;
  depositMemo: string;
  minDeposit: string;
  withdrawalFee: string;
  requiresMemo: boolean;
  isActive: boolean;
};

export function NetworkEditor({ net }: { net: NetworkVM }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [f, setF] = useState({
    depositAddress: net.depositAddress,
    depositMemo: net.depositMemo,
    minDeposit: net.minDeposit,
    withdrawalFee: net.withdrawalFee,
    requiresMemo: net.requiresMemo,
    isActive: net.isActive,
  });

  function save() {
    setMsg(null);
    start(async () => {
      const res = await updateAssetNetwork(net.id, f);
      setMsg(res.ok ? { ok: true, text: "Saved" } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-border-subtle bg-surface-raised/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs font-medium">{net.network}</span>
        <label className="flex items-center gap-1.5 text-xs text-foreground-muted">
          <input
            type="checkbox"
            checked={f.isActive}
            onChange={(e) => setF({ ...f, isActive: e.target.checked })}
            className="accent-primary"
            suppressHydrationWarning
          />
          Active
        </label>
      </div>

      <label className="mb-2 flex flex-col gap-1 text-xs text-foreground-muted">
        Deposit address (platform receiving address)
        <Input
          value={f.depositAddress}
          onChange={(e) => setF({ ...f, depositAddress: e.target.value })}
          placeholder="Not set — users see their per-user derived address"
          className="h-8 font-mono text-xs"
        />
      </label>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-foreground-muted">
          Memo/tag
          <Input value={f.depositMemo} onChange={(e) => setF({ ...f, depositMemo: e.target.value })} className="h-8 text-xs" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-foreground-muted">
          Min deposit
          <Input value={f.minDeposit} onChange={(e) => setF({ ...f, minDeposit: e.target.value })} className="h-8 font-mono text-xs" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-foreground-muted">
          Withdrawal fee
          <Input value={f.withdrawalFee} onChange={(e) => setF({ ...f, withdrawalFee: e.target.value })} className="h-8 font-mono text-xs" />
        </label>
        <label className="flex items-end gap-1.5 pb-2 text-xs text-foreground-muted">
          <input type="checkbox" checked={f.requiresMemo} onChange={(e) => setF({ ...f, requiresMemo: e.target.checked })} className="accent-primary" suppressHydrationWarning />
          Requires memo
        </label>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {msg && <span className={cn("text-xs", msg.ok ? "text-primary" : "text-danger")}>{msg.text}</span>}
      </div>
    </div>
  );
}
