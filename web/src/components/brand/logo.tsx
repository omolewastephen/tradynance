import { cn } from "@/lib/utils";

/**
 * Tradynance mark: a "T" whose crossbar doubles as a rising candlestick/arrow motif.
 * Pure inline SVG so it stays crisp at any size and themes with currentColor / brand token.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("size-7", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="var(--color-primary)" fillOpacity="0.12" />
      {/* T stem */}
      <rect x="14.5" y="9" width="3" height="15" rx="1.5" fill="var(--color-primary)" />
      {/* T crossbar */}
      <rect x="8" y="9" width="16" height="3" rx="1.5" fill="var(--color-primary)" />
      {/* rising arrow through the mark */}
      <path
        d="M9 22.5L14 17.5L18 21L24.5 14.5"
        stroke="var(--color-primary)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.5 14.5H24.5V18.5"
        stroke="var(--color-primary)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      {showWordmark && (
        <span className="font-display text-lg font-semibold tracking-tight text-foreground">
          Tradynance
        </span>
      )}
    </span>
  );
}
