import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  CandlestickChart,
  Gauge,
  Coins,
  ArrowLeftRight,
  ShieldCheck,
  Layers,
  UserPlus,
  Wallet,
  LineChart,
  Lock,
  KeyRound,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getSiteContent } from "@/lib/site-content";
import { CoinIcon } from "@/components/brand/coin-icon";
import { Reveal } from "@/components/motion/reveal";

export const metadata: Metadata = {
  title: "Tradynance — The professional crypto exchange",
  description:
    "Spot, futures, staking and convert on one fast, secure exchange built on an append-only ledger.",
};

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: CandlestickChart, title: "Spot trading", body: "A real matching engine and order book with maker/taker fees, live candlestick charts and full order history." },
  { icon: Gauge, title: "Isolated-margin futures", body: "Perpetuals up to 5× with a live liquidation engine, funding accrual and equity-based risk — losses capped at your margin." },
  { icon: Coins, title: "Staking", body: "Put idle assets to work with continuously-accruing yield. Flexible products redeem anytime; fixed terms pay more." },
  { icon: ArrowLeftRight, title: "Instant convert", body: "Swap any two assets at a server-priced rate in a single click, settled straight to your balance." },
  { icon: Layers, title: "Unified portfolio", body: "Every position, balance and trade in one view, valued live in USD with allocation and performance history." },
  { icon: ShieldCheck, title: "Correct by design", body: "Balances are derived from an append-only ledger — never a mutable number — so the books always reconcile." },
];

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: UserPlus, title: "Create your account", body: "Sign up in under a minute and secure it with two-factor authentication and an anti-phishing code." },
  { icon: Wallet, title: "Fund your wallet", body: "Deposit to your address and track it from pending to credited — every movement recorded on the ledger." },
  { icon: LineChart, title: "Trade with confidence", body: "Spot, futures, convert or stake — with live pricing and a full, auditable history of every action." },
];

const SECURITY: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: ScrollText, title: "Append-only ledger", body: "Every credit and debit is an immutable entry. Your balance is derived from that log, never edited in place." },
  { icon: KeyRound, title: "2FA & anti-phishing", body: "TOTP two-factor, backup codes, a personal anti-phishing code on every email, and session control." },
  { icon: Lock, title: "Withdrawal controls", body: "Address whitelisting, email confirmation plus a second factor, and an admin review queue on every payout." },
];

function fmtPrice(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : 2 });
}

export default async function HomePage() {
  const sc = await getSiteContent();

  const [markets, assetCount] = await Promise.all([
    prisma.market.findMany({
      where: { isActive: true, ticker: { isNot: null } },
      include: { baseAsset: { select: { symbol: true } }, ticker: true },
    }),
    prisma.asset.count(),
  ]);

  const priced = markets.filter((m) => m.ticker);
  const top = [...priced]
    .sort((a, b) => Number(b.ticker!.quoteVolume) - Number(a.ticker!.quoteVolume))
    .slice(0, 6);

  // Stats below are strictly factual about THIS platform. Deliberately no "volume" figure: the
  // ticker volume we mirror is the reference market's, and showing it would imply it's ours.

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-brand-glow" />
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-20 sm:pt-28">
          <Reveal className="mx-auto max-w-3xl text-center" y={20}>
            <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface/60 px-3 py-1 text-xs text-foreground-muted">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              {sc("home.hero.eyebrow")}
            </span>
            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Trade digital assets, <span className="text-gradient-brand">elevated.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-foreground-muted">
              {sc("home.hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] hover:bg-primary/90"
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
          </Reveal>

          {/* live markets strip — real prices from the market-data service */}
          {top.length > 0 && (
            <div className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3">
              {top.map((m, i) => {
                const change = Number(m.ticker!.priceChangePercent);
                const up = change >= 0;
                return (
                  <Reveal key={m.id} delay={0.05 * i} y={12}>
                    <Link
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
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Live stats (real data only) ── */}
      <section className="border-y border-border-subtle bg-surface/30">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 sm:grid-cols-4">
          {[
            { label: "Live markets", value: priced.length.toString() },
            { label: "Assets listed", value: assetCount.toString() },
            { label: "Max leverage", value: "5×" },
            { label: "Markets open", value: "24/7" },
          ].map((s, i) => (
            <Reveal key={s.label} delay={0.06 * i} y={10}>
              <div className="text-center">
                <div className="font-mono text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
                  {s.value}
                </div>
                <div className="mt-1 text-xs uppercase tracking-wide text-foreground-muted">
                  {s.label}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {sc("home.features.title")}
          </h2>
          <p className="mt-3 text-foreground-muted">{sc("home.features.subtitle")}</p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={0.06 * i}>
              <div className="group h-full rounded-xl border border-border-subtle bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-elevation-2">
                <div className="grid size-11 place-items-center rounded-lg bg-primary-muted text-primary transition-transform group-hover:scale-105">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-border-subtle bg-surface/30">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Start trading in three steps
            </h2>
            <p className="mt-3 text-foreground-muted">
              No complexity, no hidden mechanics — just a clear path from sign-up to your first trade.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={0.08 * i}>
                <div className="relative h-full rounded-xl border border-border-subtle bg-background p-6">
                  <span className="absolute right-5 top-5 font-mono text-3xl font-bold text-border">
                    0{i + 1}
                  </span>
                  <div className="grid size-11 place-items-center rounded-lg bg-accent/10 text-accent">
                    <s.icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security / trust ── */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <span className="text-micro uppercase tracking-wider text-primary">Security</span>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Built so the numbers can&apos;t drift
            </h2>
            <p className="mt-4 text-foreground-muted">
              Most early exchanges store your balance as a number they add to and subtract from —
              until a retry fires twice or an error lands mid-update. Tradynance never does that.
              Every movement is an immutable ledger entry, and your balance is derived from the log.
            </p>
            <Link
              href="/about"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
            >
              How we build <ArrowRight className="size-4" />
            </Link>
          </Reveal>
          <div className="grid gap-4">
            {SECURITY.map((s, i) => (
              <Reveal key={s.title} delay={0.07 * i} y={12}>
                <div className="flex gap-4 rounded-xl border border-border-subtle bg-surface p-5">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-muted text-primary">
                    <s.icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-foreground-muted">{s.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-surface px-6 py-14 text-center">
            <div className="pointer-events-none absolute inset-0 bg-brand-glow" />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {sc("home.cta.title")}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-foreground-muted">{sc("home.cta.subtitle")}</p>
              <Link
                href="/register"
                className="mt-7 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] hover:bg-primary/90"
              >
                {sc("home.cta.button")} <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
