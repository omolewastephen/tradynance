import type { Metadata } from "next";
import { Crown } from "lucide-react";

import { get30dVolume, vipTierFor, nextVipTier, effectiveTakerBps, VIP_TIERS } from "@tradynance/core";
import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "VIP — Tradynance" };

// Markets are seeded with a 20 bps (0.20%) base taker fee; show the effective rate per tier.
const BASE_TAKER_BPS = 20;

function usd(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function pct(bps: number) {
  return `${(bps / 100).toFixed(3)}%`;
}

export default async function VipPage() {
  const session = await requireUser();
  const volume = await get30dVolume(prisma as never, session.user.id);
  const tier = vipTierFor(volume);
  const next = nextVipTier(tier);

  const progress = next
    ? Math.min(100, ((volume - tier.min30dVolume) / (next.min30dVolume - tier.min30dVolume)) * 100)
    : 100;
  const toNext = next ? Math.max(0, next.min30dVolume - volume) : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl animate-fade-rise flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">VIP tiers</h1>
        <p className="text-sm text-foreground-muted">
          Higher 30-day trading volume unlocks lower taker fees. Volume counts spot fills and
          futures notional.
        </p>
      </div>

      {/* current status */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
              <Crown className="size-6" />
            </div>
            <div>
              <div className="text-micro uppercase tracking-wide text-foreground-muted">
                Current tier
              </div>
              <div className="text-lg font-semibold">{tier.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-micro uppercase tracking-wide text-foreground-muted">
              30-day volume
            </div>
            <div className="font-mono text-lg font-semibold tabular-nums">${usd(volume)}</div>
          </div>
          <div className="text-right">
            <div className="text-micro uppercase tracking-wide text-foreground-muted">
              Your taker fee
            </div>
            <div className="font-mono text-lg font-semibold tabular-nums text-primary">
              {pct(effectiveTakerBps(BASE_TAKER_BPS, tier))}
            </div>
          </div>
        </div>

        {next ? (
          <div className="mt-5">
            <div className="mb-1.5 flex justify-between text-xs text-foreground-muted">
              <span>Progress to {next.name}</span>
              <span className="font-mono tabular-nums">${usd(toNext)} to go</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <p className="mt-5 text-sm text-primary">You&apos;re at the top tier. 👑</p>
        )}
      </Card>

      {/* tier table */}
      <Card className="p-0">
        <div className="border-b border-border-subtle px-4 py-3 text-sm font-medium">All tiers</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground-muted [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                <th>Tier</th>
                <th className="text-right">30-day volume</th>
                <th className="text-right">Taker fee</th>
                <th className="text-right">Taker discount</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-t [&>tr]:border-border-subtle">
              {VIP_TIERS.map((t) => (
                <tr
                  key={t.level}
                  className={cn(
                    "[&>td]:px-4 [&>td]:py-2.5",
                    t.level === tier.level && "bg-primary/[0.06]",
                  )}
                >
                  <td className="font-medium">
                    {t.name}
                    {t.level === tier.level && (
                      <span className="ml-2 rounded-xs bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                        You
                      </span>
                    )}
                  </td>
                  <td className="text-right font-mono tabular-nums text-foreground-muted">
                    ≥ ${usd(t.min30dVolume)}
                  </td>
                  <td className="text-right font-mono tabular-nums">
                    {pct(effectiveTakerBps(BASE_TAKER_BPS, t))}
                  </td>
                  <td className="text-right font-mono tabular-nums text-primary">
                    {t.takerDiscountBps > 0 ? `−${t.takerDiscountBps / 100}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-xs text-foreground-muted">
          Discounts apply to taker fees on spot and futures. Maker (resting) fees are unchanged for
          now.
        </p>
      </Card>
    </div>
  );
}
