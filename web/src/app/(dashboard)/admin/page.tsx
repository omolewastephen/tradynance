import Link from "next/link";
import { Users, ShieldQuestion, Landmark, Banknote, ArrowLeftRight, Repeat } from "lucide-react";

import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { SYSTEM_EMAIL } from "@/lib/admin";
import { Card } from "@/components/ui/card";

const usd = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
}) {
  const inner = (
    <Card className="h-full p-5 transition-colors hover:bg-surface-raised/50">
      <span className="text-micro uppercase tracking-wide text-foreground-muted">{label}</span>
      <div className="mt-2 font-mono text-data-lg tabular-nums">{value}</div>
      {hint && <span className="mt-1 block text-xs text-foreground-muted">{hint}</span>}
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function AdminPage() {
  await requireAdmin();

  const [
    totalUsers,
    activeUsers,
    pendingKyc,
    pendingDeposits,
    pendingWithdrawals,
    tradeAgg,
    feeAgg,
    conversions,
  ] = await Promise.all([
    prisma.user.count({ where: { email: { not: SYSTEM_EMAIL } } }),
    prisma.user.count({ where: { status: "ACTIVE", email: { not: SYSTEM_EMAIL } } }),
    prisma.user.count({ where: { kycStatus: "PENDING" } }),
    prisma.deposit.count({ where: { status: { in: ["PENDING", "CONFIRMED"] } } }),
    prisma.withdrawal.count({ where: { status: { in: ["PENDING", "APPROVED", "PROCESSING"] } } }),
    // Traded notional (quote): Σ price×quantity. Prisma can't multiply in aggregate, so pull sums.
    prisma.trade.aggregate({ _count: true }),
    prisma.trade.aggregate({ _sum: { buyerFee: true, sellerFee: true } }),
    prisma.conversion.count(),
  ]);

  // Trade volume + fee revenue in quote (USDT ≈ USD). Volume needs price×qty per row.
  const trades = await prisma.trade.findMany({ select: { price: true, quantity: true } });
  const tradeVolume = trades.reduce((s, t) => s + Number(t.price) * Number(t.quantity), 0);
  const feeRevenue =
    Number(feeAgg._sum.buyerFee ?? 0) + Number(feeAgg._sum.sellerFee ?? 0);

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <div>
        <h1 className="font-display text-h1 tracking-tight">Admin</h1>
        <p className="text-foreground-muted">Platform overview and controls.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Users" value={totalUsers} hint={`${activeUsers} active`} href="/admin/users" />
        <StatTile label="Pending KYC" value={pendingKyc} href="/admin/kyc" />
        <StatTile label="Pending deposits" value={pendingDeposits} href="/admin/deposits" />
        <StatTile label="Pending withdrawals" value={pendingWithdrawals} href="/admin/withdrawals" />
        <StatTile label="Trades" value={tradeAgg._count} />
        <StatTile label="Trade volume" value={`$${usd(tradeVolume)}`} hint="quote notional" />
        <StatTile label="Fee revenue" value={`$${usd(feeRevenue)}`} hint="taker + maker fees" />
        <StatTile label="Conversions" value={conversions} />
      </div>

      <Card className="p-5">
        <h2 className="mb-3 font-display text-h4">Manage</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <AdminLink href="/admin/users" icon={<Users className="size-4" />} label="Users" desc="View, suspend, roles, reset 2FA" />
          <AdminLink href="/admin/kyc" icon={<ShieldQuestion className="size-4" />} label="KYC review" desc="Approve or reject verification" />
          <AdminLink href="/admin/deposits" icon={<Landmark className="size-4" />} label="Deposits" desc="Manual credit & pending queue" />
          <AdminLink href="/admin/withdrawals" icon={<Banknote className="size-4" />} label="Withdrawals" desc="Approval queue" />
          <AdminLink href="/admin/audit" icon={<ArrowLeftRight className="size-4" />} label="Audit log" desc="Append-only action history" />
          <AdminLink href="/markets" icon={<Repeat className="size-4" />} label="Markets" desc="Live market data" />
        </div>
      </Card>
    </div>
  );
}

function AdminLink({
  href,
  icon,
  label,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-sm border border-border-subtle p-3 transition-colors hover:border-primary/40 hover:bg-surface-raised/50"
    >
      <span className="mt-0.5 flex size-8 items-center justify-center rounded-sm bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-foreground-muted">{desc}</div>
      </div>
    </Link>
  );
}
