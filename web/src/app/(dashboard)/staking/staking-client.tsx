"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coins, Lock, Unlock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CoinIcon } from "@/components/brand/coin-icon";
import { stakeAsset, redeemStakePosition } from "./actions";

export type ProductVM = {
  id: string;
  assetId: string;
  symbol: string;
  name: string;
  aprBps: number;
  lockDays: number;
  minStake: number;
  available: number;
};

export type PositionVM = {
  id: string;
  symbol: string;
  productName: string;
  principal: number;
  aprBps: number;
  lockDays: number;
  startAt: string;
  unlockAt: string | null;
  status: "ACTIVE" | "REDEEMED";
  rewardPaid: number;
  redeemedAt: string | null;
};

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function accrued(p: PositionVM, now: number): number {
  let elapsed = now - new Date(p.startAt).getTime();
  if (elapsed <= 0) return 0;
  if (p.lockDays > 0) elapsed = Math.min(elapsed, p.lockDays * 24 * 60 * 60 * 1000);
  return p.principal * (p.aprBps / 10_000) * (elapsed / YEAR_MS);
}
function fmt(n: number, dp = 6) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: dp });
}

export function StakingClient({
  products,
  positions,
}: {
  products: ProductVM[];
  positions: PositionVM[];
}) {
  const active = positions.filter((p) => p.status === "ACTIVE");
  const history = positions.filter((p) => p.status === "REDEEMED");

  return (
    <div className="flex flex-col gap-6">
      {active.length > 0 && <ActivePositions positions={active} />}

      <section>
        <h2 className="mb-3 text-sm font-medium text-foreground-muted">Products</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {history.length > 0 && <History positions={history} />}
    </div>
  );
}

function ProductCard({ product }: { product: ProductVM }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const amt = Number(amount) || 0;
  const invalid = amt > 0 && (amt < product.minStake || amt > product.available);

  function submit() {
    setMsg(null);
    start(async () => {
      const res = await stakeAsset(product.id, amount);
      if (res.ok) {
        setMsg({ ok: true, text: `Staked ${amount} ${product.symbol}` });
        setAmount("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CoinIcon symbol={product.symbol} size={26} />
          <div>
            <div className="text-sm font-medium">{product.name}</div>
            <div className="flex items-center gap-1 text-xs text-foreground-muted">
              {product.lockDays > 0 ? (
                <>
                  <Lock className="size-3" /> {product.lockDays}-day lock
                </>
              ) : (
                <>
                  <Unlock className="size-3" /> Flexible
                </>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-semibold tabular-nums text-primary">
            {(product.aprBps / 100).toFixed(2)}%
          </div>
          <div className="text-micro uppercase tracking-wide text-foreground-muted">APR</div>
        </div>
      </div>

      <div className="flex justify-between text-xs text-foreground-muted">
        <span>Available</span>
        <span className="font-mono tabular-nums">
          {fmt(product.available)} {product.symbol}
        </span>
      </div>

      <Input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        placeholder={`Min ${product.minStake} ${product.symbol}`}
        className="font-mono"
      />

      <button
        onClick={submit}
        disabled={pending || amt <= 0 || invalid}
        className="rounded-sm bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "Staking…" : invalid && amt < product.minStake ? `Min ${product.minStake}` : invalid ? "Insufficient" : "Stake"}
      </button>
      {msg && <p className={cn("text-xs", msg.ok ? "text-primary" : "text-danger")}>{msg.text}</p>}
    </Card>
  );
}

function ActivePositions({ positions }: { positions: PositionVM[] }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function redeem(id: string) {
    setBusy(id);
    start(async () => {
      await redeemStakePosition(id);
      setBusy(null);
      router.refresh();
    });
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-foreground-muted">Your stakes</h2>
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground-muted [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                <th>Product</th>
                <th className="text-right">Principal</th>
                <th className="text-right">APR</th>
                <th className="text-right">Reward (accruing)</th>
                <th className="text-right">Unlocks</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-t [&>tr]:border-border-subtle">
              {positions.map((p) => {
                const reward = accrued(p, now);
                const locked = p.unlockAt != null && now < new Date(p.unlockAt).getTime();
                return (
                  <tr key={p.id} className="[&>td]:px-4 [&>td]:py-3">
                    <td className="font-medium">{p.productName}</td>
                    <td className="text-right font-mono tabular-nums">
                      {fmt(p.principal)} {p.symbol}
                    </td>
                    <td className="text-right font-mono tabular-nums text-primary">
                      {(p.aprBps / 100).toFixed(2)}%
                    </td>
                    <td className="text-right font-mono tabular-nums text-price-up">
                      +{reward.toFixed(8)} {p.symbol}
                    </td>
                    <td className="text-right text-xs text-foreground-muted">
                      {p.unlockAt ? new Date(p.unlockAt).toLocaleDateString() : "Flexible"}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => redeem(p.id)}
                        disabled={locked || (pending && busy === p.id)}
                        title={locked ? "Locked until the unlock date" : "Redeem principal + reward"}
                        className="rounded-xs border border-border px-2.5 py-1 text-xs text-foreground-muted transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-40"
                      >
                        {pending && busy === p.id ? "…" : locked ? "Locked" : "Redeem"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function History({ positions }: { positions: PositionVM[] }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground-muted">
        <Coins className="size-4" /> History
      </h2>
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground-muted [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                <th>Product</th>
                <th className="text-right">Principal</th>
                <th className="text-right">Reward earned</th>
                <th className="text-right">Redeemed</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-t [&>tr]:border-border-subtle">
              {positions.map((p) => (
                <tr key={p.id} className="[&>td]:px-4 [&>td]:py-2.5">
                  <td className="font-medium">{p.productName}</td>
                  <td className="text-right font-mono tabular-nums">
                    {fmt(p.principal)} {p.symbol}
                  </td>
                  <td className="text-right font-mono tabular-nums text-price-up">
                    +{fmt(p.rewardPaid, 8)} {p.symbol}
                  </td>
                  <td className="text-right text-xs text-foreground-muted">
                    {p.redeemedAt ? new Date(p.redeemedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
