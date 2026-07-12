import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  CandlestickChart,
  Gauge,
  Coins,
  ArrowLeftRight,
  Rocket,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSiteContent } from "@/lib/site-content";
import { CoinIcon } from "@/components/brand/coin-icon";

export const metadata: Metadata = {
  title: "Tradynance — The professional crypto exchange",
  description:
    "Spot, futures, staking and convert on one fast, secure exchange built on an append-only ledger.",
};

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: CandlestickChart, title: "Spot trading", body: "A real matching engine and order book across 14 markets, with maker/taker fees and live charts." },
  { icon: Gauge, title: "Isolated-margin futures", body: "Perpetuals up to 5× with a live liquidation engine, funding, and equity-based risk." },
  { icon: Coins, title: "Staking", body: "Earn continuously-accruing yield on idle assets — flexible or fixed-term, redeem anytime." },
  { icon: ArrowLeftRight, title: "Instant convert", body: "Swap any two assets at a server-priced rate in one click, settled straight to your balance." },
  { icon: Rocket, title: "Launchpad & NFTs", body: "Commit to new token sales and trade generative NFTs, all settled through the same ledger." },
  { icon: ShieldCheck, title: "Correct by design", body: "Every balance is derived from an append-only ledger, 2FA + anti-phishing, and rate-limited APIs." },
];

function fmtPrice(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : 2 });
}

export default async function HomePage() {
  const sc = await getSiteContent();

  const markets = await prisma.market.findMany({
    where: { isActive: true, ticker: { isNot: null } },
    include: { baseAsset: { select: { symbol: true } }, ticker: true },
  });
  const top = markets
    .filter((m) => m.ticker)
    .sort((a, b) => Number(b.ticker!.quoteVolume) - Number(a.ticker!.quoteVolume))
    .slice(0, 6);

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-brand-glow" />
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface/60 px-3 py-1 text-xs text-foreground-muted">
              <span className="size-1.5 rounded-full bg-primary" />
              {sc("home.hero.eyebrow")}
            </span>
            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Trade digital assets,{" "}
              <span className="text-gradient-brand">elevated.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-foreground-muted">
              {sc("home.hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-colors hover:bg-primary/90"
              >
                {sc("home.hero.ctaPrimary")} <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/markets"
                className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface"
              >
                {sc("home.hero.ctaSecondary")}
              </Link>
            </div>
          </div>

          {/* live markets strip */}
          {top.length > 0 && (
            <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3">
              {top.map((m) => {
                const change = Number(m.ticker!.priceChangePercent);
                const up = change >= 0;
                return (
                  <Link
                    key={m.id}
                    href={`/markets/${m.symbol}`}
                    className="glass flex items-center justify-between rounded-lg px-4 py-3 transition-colors hover:border-border"
                  >
                    <div className="flex items-center gap-2.5">
                      <CoinIcon symbol={m.baseAsset.symbol} size={26} />
                      <div>
                        <div className="text-sm font-medium">{m.baseAsset.symbol}</div>
                        <div className="font-mono text-xs tabular-nums text-foreground-muted">
                          ${fmtPrice(Number(m.ticker!.lastPrice))}
                        </div>
                      </div>
                    </div>
                    <span className={"font-mono text-sm tabular-nums " + (up ? "text-price-up" : "text-price-down")}>
                      {up ? "+" : ""}
                      {change.toFixed(2)}%
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {sc("home.features.title")}
          </h2>
          <p className="mt-3 text-foreground-muted">{sc("home.features.subtitle")}</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border-subtle bg-surface p-6 transition-colors hover:border-border"
            >
              <div className="grid size-11 place-items-center rounded-lg bg-primary-muted text-primary">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-foreground-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface px-6 py-14 text-center">
          <div className="pointer-events-none absolute inset-0 bg-brand-glow" />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {sc("home.cta.title")}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-foreground-muted">{sc("home.cta.subtitle")}</p>
            <Link
              href="/register"
              className="mt-7 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-colors hover:bg-primary/90"
            >
              {sc("home.cta.button")} <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
