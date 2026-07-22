import Link from "next/link";
import { ScrollText, ShieldCheck, Layers } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { prisma } from "@/lib/prisma";
import {
  getAuthMarkets,
  MarketRailList,
  MarketRailStrip,
} from "@/components/auth/market-rail";

const POINTS: { icon: typeof ScrollText; text: string }[] = [
  { icon: ScrollText, text: "Append-only ledger — the books always reconcile" },
  { icon: ShieldCheck, text: "2FA, anti-phishing codes and withdrawal whitelists" },
  { icon: Layers, text: "Spot, futures, staking and convert in one account" },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // One query, shared by the desktop panel and the mobile strip. Counts are factual platform
  // figures (no fabricated volume — same principle as the marketing home).
  const [rows, assetCount, marketCount] = await Promise.all([
    getAuthMarkets(),
    prisma.asset.count().catch(() => 0),
    prisma.market.count({ where: { isActive: true } }).catch(() => 0),
  ]);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      {/* ── Brand + live-market panel (desktop only) ── */}
      <aside className="relative hidden min-w-0 overflow-hidden border-r border-border-subtle bg-background lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-brand-glow" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-50" />

        <div className="relative z-10">
          <Link href="/" aria-label="Tradynance home">
            <Logo size="lg" />
          </Link>
        </div>

        <div className="relative z-10 max-w-md">
          {/* Deliberately a <p>, not a heading: this is brand copy. The page's real title is the
              form's <h1> ("Welcome back" / "Create your account") — a decorative h2 before it broke
              the document outline for screen-reader users. */}
          <p className="font-display text-4xl font-bold leading-[1.1] tracking-tight text-foreground xl:text-5xl">
            Trade digital assets, <span className="text-gradient-brand">elevated.</span>
          </p>
          <p className="mt-4 text-base leading-relaxed text-foreground-muted">
            A fast, secure exchange built on an append-only ledger. Spot, futures, staking and
            convert — one account, correct by design.
          </p>
          <ul className="mt-8 flex flex-col gap-3.5">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-sm text-foreground">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-primary-muted text-primary">
                  <p.icon className="size-4" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground-subtle">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Live markets
            </span>
            {assetCount > 0 && (
              <span className="font-mono text-xs tabular-nums text-foreground-subtle">
                {assetCount} assets · {marketCount} markets
              </span>
            )}
          </div>
          <MarketRailList rows={rows} />
        </div>
      </aside>

      {/* ── Form column ── */}
      {/* min-w-0: grid items default to min-width:auto and refuse to shrink below their content's
          intrinsic width — the no-wrap ticker strip (~448px) was forcing the whole column, and the
          page, wider than a phone viewport. min-w-0 lets the column track the viewport so the
          strip's own overflow-x-auto actually engages. */}
      <main className="relative flex min-h-dvh min-w-0 flex-col bg-surface/20">
        {/* Mobile brand bar (the panel is hidden < lg). */}
        <div className="flex items-center px-5 pt-6 lg:hidden">
          <Link href="/" aria-label="Tradynance home">
            <Logo />
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-start px-5 pb-8 pt-10 sm:px-8 lg:justify-center lg:pt-8">
          <div className="mx-auto w-full max-w-md">
            {children}
            {/* Mobile-only live strip — keeps the small screen contentful without the full panel. */}
            <MarketRailStrip rows={rows} className="mt-8 lg:hidden" />
          </div>
        </div>

        <footer className="px-5 pb-6 sm:px-8">
          <div className="mx-auto flex w-full max-w-md items-center justify-between text-xs text-foreground-subtle">
            <span>© {new Date().getFullYear()} Tradynance</span>
            <Link href="/contact" className="transition-colors hover:text-foreground-muted">
              Need help?
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
