"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAntiPhishingCode } from "./actions";

export function AntiPhishingForm({ initialCode }: { initialCode: string | null }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        setError(null);
        startTransition(async () => {
          try {
            await updateAntiPhishingCode(code);
            setSaved(true);
          } catch {
            setError("Could not save. Use 4-20 letters/numbers.");
          }
        });
      }}
      className="flex flex-col gap-3"
    >
      <p className="text-sm text-foreground-muted">
        This code is included in every email we send you, so you can tell a real Tradynance
        email from a phishing attempt.
      </p>
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="antiPhishingCode">Anti-phishing code</Label>
          <Input
            id="antiPhishingCode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono"
            maxLength={20}
          />
        </div>
        <Button type="submit" disabled={isPending} variant="secondary">
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
      {saved && <p className="text-xs text-primary">Saved.</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}
