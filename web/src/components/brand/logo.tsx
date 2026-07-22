"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Tradynance mark: three ascending market bars (growth) on a gradient onyx→emerald→blue tile.
 * Bold and legible at any size; the gradient is self-contained so it reads on any background.
 *
 * The gradient id is per-instance (useId) on purpose: when two marks are in the DOM at once — e.g.
 * a `hidden lg:flex` desktop panel plus a mobile header — a shared id makes every `url(#id)` resolve
 * to the FIRST match, which may sit inside a `display:none` container and never paints, blanking the
 * visible logo. Unique ids keep each mark's fill pointed at its own gradient.
 */
export function LogoMark({ className }: { className?: string }) {
  const gid = `tdy-tile-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("size-8", className)} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#12D07A" />
          <stop offset="1" stopColor="#4C82FB" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gid})`} />
      {/* ascending bars */}
      <rect x="7.5" y="18" width="3.6" height="7" rx="1.8" fill="#fff" fillOpacity="0.72" />
      <rect x="14.2" y="13" width="3.6" height="12" rx="1.8" fill="#fff" fillOpacity="0.86" />
      <rect x="20.9" y="7.5" width="3.6" height="17.5" rx="1.8" fill="#fff" />
      {/* uptick accent through the tops */}
      <path
        d="M8 17.5L15.5 12.5L22.5 7"
        stroke="#04140A"
        strokeOpacity="0.28"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  showWordmark = true,
  size = "md",
}: {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const mark = size === "lg" ? "size-9" : size === "sm" ? "size-7" : "size-8";
  const word = size === "lg" ? "text-xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={mark} />
      {showWordmark && (
        <span className={cn("font-display font-semibold tracking-tight text-foreground", word)}>
          Tradynance
        </span>
      )}
    </span>
  );
}
