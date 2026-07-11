import type { Metadata } from "next";
import { Users, Coins, Percent } from "lucide-react";

import { REFERRAL_COMMISSION_BPS } from "@tradynance/core";
import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { ReferralLink } from "./referral-link";

export const metadata: Metadata = { title: "Referrals — Tradynance" };

function fmt(n: number, dp = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  const head = user.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export default async function ReferralsPage() {
  const session = await requireUser();

  const [me, referrals, commissions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { referralCode: true, _count: { select: { referrals: true } } },
    }),
    prisma.user.findMany({
      where: { referredById: session.user.id },
      select: { username: true, email: true, createdAt: true, status: true, kycStatus: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.referralCommission.findMany({
      where: { referrerId: session.user.id },
      include: { asset: { select: { symbol: true } }, referee: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  // Total earned per asset (mostly USDT).
  const earned = new Map<string, number>();
  for (const c of commissions) {
    earned.set(c.asset.symbol, (earned.get(c.asset.symbol) ?? 0) + Number(c.commissionAmount));
  }
  const earnedSummary =
    earned.size === 0
      ? "0.00 USDT"
      : [...earned.entries()].map(([sym, amt]) => `${fmt(amt, sym === "USDT" ? 2 : 6)} ${sym}`).join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-4xl animate-fade-rise flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Referrals</h1>
        <p className="text-sm text-foreground-muted">
          Invite friends and earn {REFERRAL_COMMISSION_BPS / 100}% of their trading fees, forever.
        </p>
      </div>

      <ReferralLink code={me.referralCode} />

      {/* stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Users} label="Total referrals" value={String(me._count.referrals)} />
        <Stat icon={Coins} label="Commission earned" value={earnedSummary} />
        <Stat icon={Percent} label="Commission rate" value={`${REFERRAL_COMMISSION_BPS / 100}%`} />
      </div>

      {/* referred users */}
      <Card className="p-0">
        <div className="border-b border-border-subtle px-4 py-3 text-sm font-medium">Your referrals</div>
        {referrals.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-foreground-muted">
            No referrals yet. Share your link to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs text-foreground-muted [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                  <th>User</th>
                  <th>Joined</th>
                  <th>KYC</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-t [&>tr]:border-border-subtle">
                {referrals.map((r) => (
                  <tr key={r.email} className="[&>td]:px-4 [&>td]:py-2.5">
                    <td className="font-medium">{r.username ?? maskEmail(r.email)}</td>
                    <td className="text-foreground-muted">{r.createdAt.toLocaleDateString()}</td>
                    <td className="text-foreground-muted">{r.kycStatus}</td>
                    <td className="text-right">
                      <span className="text-xs text-foreground-muted">{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* commission history */}
      <Card className="p-0">
        <div className="border-b border-border-subtle px-4 py-3 text-sm font-medium">
          Commission history
        </div>
        {commissions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-foreground-muted">
            Commissions from your referrals&apos; trades will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs text-foreground-muted [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                  <th>From</th>
                  <th className="text-right">Fee</th>
                  <th className="text-right">Commission</th>
                  <th className="text-right">When</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-t [&>tr]:border-border-subtle">
                {commissions.map((c) => (
                  <tr key={c.id} className="[&>td]:px-4 [&>td]:py-2.5">
                    <td className="text-foreground-muted">{c.referee.username ?? "referral"}</td>
                    <td className="text-right font-mono tabular-nums text-foreground-muted">
                      {fmt(Number(c.feeAmount), 4)} {c.asset.symbol}
                    </td>
                    <td className="text-right font-mono tabular-nums text-price-up">
                      +{fmt(Number(c.commissionAmount), 4)} {c.asset.symbol}
                    </td>
                    <td className="text-right text-xs text-foreground-muted">
                      {c.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="grid size-10 shrink-0 place-items-center rounded-full border border-border-subtle text-primary">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="text-micro uppercase tracking-wide text-foreground-muted">{label}</div>
        <div className="truncate text-lg font-semibold">{value}</div>
      </div>
    </Card>
  );
}
