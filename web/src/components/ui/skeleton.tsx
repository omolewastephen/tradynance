import { cn } from "@/lib/utils";

/** Neutral loading placeholder block. Pair with route-level loading.tsx files. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-surface-raised/70", className)}
    />
  );
}
