"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approveWithdrawal, rejectWithdrawal } from "./actions";

export function ReviewActions({ withdrawalId }: { withdrawalId: string }) {
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (mode === "approve") {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="tx hash (optional)"
          className="h-8 w-40 font-mono text-xs"
        />
        <Button
          size="sm"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await approveWithdrawal(withdrawalId, value);
              if (!res.ok) setError(res.error);
              else setMode("idle");
            })
          }
        >
          Confirm
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
          Cancel
        </Button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    );
  }

  if (mode === "reject") {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="reason"
          className="h-8 w-40 text-xs"
        />
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await rejectWithdrawal(withdrawalId, value);
              setMode("idle");
            })
          }
        >
          Confirm reject
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => { setValue(""); setError(null); setMode("approve"); }}>
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => { setValue(""); setMode("reject"); }}
      >
        Reject
      </Button>
    </div>
  );
}
