"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function ReferralLink({ code }: { code: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  // Compute after mount so SSR and the first client render match (no hydration mismatch);
  // the origin is only known in the browser.
  const [link, setLink] = useState("");
  useEffect(() => {
    setLink(`${window.location.origin}/register?ref=${code}`);
  }, [code]);

  function copy(value: string, which: "code" | "link") {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Your referral code">
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate font-mono text-lg font-semibold tracking-wide">{code}</span>
          <CopyBtn active={copied === "code"} onClick={() => copy(code, "code")} />
        </div>
      </Field>
      <Field label="Invite link">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 shrink-0 text-foreground-muted" />
          <span className="flex-1 truncate text-sm text-foreground-muted">{link || "…"}</span>
          <CopyBtn active={copied === "link"} onClick={() => copy(link, "link")} />
        </div>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="mb-1.5 text-micro uppercase tracking-wide text-foreground-muted">{label}</div>
      {children}
    </div>
  );
}

function CopyBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-sm border border-border transition-colors",
        active ? "border-primary/50 text-primary" : "text-foreground-muted hover:text-foreground",
      )}
      aria-label="Copy"
    >
      {active ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}
