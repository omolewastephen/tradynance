import { CheckCircle2, Clock, MinusCircle, XCircle, Ban, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** "SUPER_ADMIN" → "Super Admin" — raw enum values are implementation detail, not UI copy. */
export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const STYLES: Record<string, { icon: LucideIcon; cls: string }> = {
  // positive
  VERIFIED: { icon: CheckCircle2, cls: "border-primary/25 bg-primary/10 text-primary" },
  ACTIVE: { icon: CheckCircle2, cls: "border-primary/25 bg-primary/10 text-primary" },
  // in progress
  PENDING: { icon: Clock, cls: "border-warning/25 bg-warning/10 text-warning" },
  // neutral / not started
  UNVERIFIED: { icon: MinusCircle, cls: "border-border bg-surface-raised/60 text-foreground-muted" },
  // negative
  REJECTED: { icon: XCircle, cls: "border-danger/25 bg-danger/10 text-danger" },
  SUSPENDED: { icon: Ban, cls: "border-danger/25 bg-danger/10 text-danger" },
  BANNED: { icon: Ban, cls: "border-danger/25 bg-danger/10 text-danger" },
};

/**
 * Status as a pill: humanized label + icon + tint. The icon carries the meaning alongside color
 * (WCAG color-not-only) — a colorblind trader must still be able to tell verified from rejected.
 */
export function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = STYLES[status] ?? {
    icon: MinusCircle,
    cls: "border-border bg-surface-raised/60 text-foreground-muted",
  };
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        s.cls,
        className,
      )}
    >
      <Icon className="size-3.5" />
      {humanize(status)}
    </span>
  );
}
