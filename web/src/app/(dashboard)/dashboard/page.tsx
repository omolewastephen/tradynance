import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, ShieldCheck, Wallet } from "lucide-react";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <span className="text-micro uppercase tracking-wide text-foreground-muted">
        {label}
      </span>
      <div className="mt-2 font-mono text-data-lg tabular-nums">{value}</div>
      {hint && <span className="mt-1 block text-xs text-foreground-muted">{hint}</span>}
    </Card>
  );
}

export default async function DashboardPage() {
  const session = await requireUser();

  const wallets = await prisma.wallet.findMany({
    where: { userId: session.user.id },
    include: { asset: { select: { symbol: true } } },
  });
  const assetsHeld = wallets.filter((w) => Number(w.balance) > 0).length;

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <div>
        <h1 className="font-display text-h1 tracking-tight">Overview</h1>
        <p className="text-foreground-muted">
          Welcome back, {session.user.email}
        </p>
      </div>

      {/* Portfolio hero */}
      <Card className="relative overflow-hidden p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/10 blur-3xl"
        />
        <span className="text-micro uppercase tracking-wide text-foreground-muted">
          Estimated balance
        </span>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-semibold tabular-nums">$0.00</span>
          <span className="font-mono text-sm text-foreground-muted">USD</span>
        </div>
        <p className="mt-1 text-xs text-foreground-muted">
          Live USD valuation and PnL connect with market data (Phase 4). Per-asset balances
          are on the Wallet page.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/wallet"
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ArrowDownToLine className="size-4" />
            Deposit
          </Link>
          <span
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-sm border border-border px-4 py-2 text-sm text-foreground-muted"
            title="Withdrawals land in Phase 3"
          >
            <ArrowUpFromLine className="size-4" />
            Withdraw
          </span>
          <Link
            href="/settings/security"
            className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface"
          >
            <ShieldCheck className="size-4" />
            Security
          </Link>
        </div>
      </Card>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Assets held" value={assetsHeld} hint={`${wallets.length} wallets`} />
        <StatTile
          label="KYC status"
          value={<span className="text-lg">{session.user.kycStatus as string}</span>}
        />
        <StatTile
          label="Account"
          value={<span className="text-lg">{session.user.role as string}</span>}
        />
        <StatTile
          label="Status"
          value={<span className="text-lg text-primary">{session.user.status as string}</span>}
        />
      </div>

      {/* Getting started */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Wallet className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-h4">Fund your account</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Generate a deposit address and send crypto to get started. BTC (testnet) and ETH
              (Sepolia) credit automatically; other assets are listed and expand as networks
              are integrated.
            </p>
            <Link
              href="/wallet"
              className="mt-3 inline-block text-sm text-accent hover:underline"
            >
              Go to Wallet →
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
