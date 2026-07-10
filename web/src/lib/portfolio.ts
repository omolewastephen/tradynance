import "server-only";

import { prisma } from "@/lib/prisma";

export type Holding = {
  symbol: string;
  name: string;
  amount: number; // total across all wallets (incl. SPOT)
  price: number | null; // USD; null if no market
  value: number; // USD (0 if no price)
  change24h: number | null; // % from ticker
  allocation: number; // % of portfolio value
};

export type PortfolioSummary = {
  totalValue: number;
  value24hAgo: number;
  change24hUsd: number;
  change24hPct: number;
  holdings: Holding[]; // held assets (amount > 0), value-desc
};

/**
 * Current portfolio: holdings valued at live prices, plus a 24h change derived from each
 * asset's ticker 24h % (price_24h_ago = price / (1 + pct/100)). Real, no snapshot infra.
 */
export async function getPortfolio(userId: string): Promise<PortfolioSummary> {
  const [wallets, markets] = await Promise.all([
    prisma.wallet.findMany({
      where: { userId },
      include: { asset: { select: { symbol: true, name: true } } },
    }),
    prisma.market.findMany({
      where: { ticker: { isNot: null } },
      select: { baseAsset: { select: { symbol: true } }, ticker: true },
    }),
  ]);

  // price + 24h% per asset symbol (stables pinned to 1, flat).
  const priceOf = new Map<string, number>([["USDT", 1], ["USDC", 1]]);
  const changeOf = new Map<string, number>([["USDT", 0], ["USDC", 0]]);
  for (const m of markets) {
    if (!m.ticker) continue;
    priceOf.set(m.baseAsset.symbol, Number(m.ticker.lastPrice));
    changeOf.set(m.baseAsset.symbol, Number(m.ticker.priceChangePercent));
  }

  // Sum amounts per asset across wallets.
  const byAsset = new Map<string, { symbol: string; name: string; amount: number }>();
  for (const w of wallets) {
    const cur = byAsset.get(w.assetId) ?? {
      symbol: w.asset.symbol,
      name: w.asset.name,
      amount: 0,
    };
    cur.amount += Number(w.balance);
    byAsset.set(w.assetId, cur);
  }

  let totalValue = 0;
  let value24hAgo = 0;
  const rows: Omit<Holding, "allocation">[] = [];
  for (const a of byAsset.values()) {
    if (a.amount <= 0) continue;
    const price = priceOf.get(a.symbol) ?? null;
    const change24h = changeOf.get(a.symbol) ?? null;
    const value = price !== null ? price * a.amount : 0;
    totalValue += value;
    if (price !== null && change24h !== null) {
      value24hAgo += (price / (1 + change24h / 100)) * a.amount;
    } else {
      value24hAgo += value;
    }
    rows.push({ symbol: a.symbol, name: a.name, amount: a.amount, price, value, change24h });
  }

  const holdings: Holding[] = rows
    .map((r) => ({ ...r, allocation: totalValue > 0 ? (r.value / totalValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  const change24hUsd = totalValue - value24hAgo;
  const change24hPct = value24hAgo > 0 ? (change24hUsd / value24hAgo) * 100 : 0;

  return { totalValue, value24hAgo, change24hUsd, change24hPct, holdings };
}

export type Activity = {
  kind: "Deposit" | "Withdrawal" | "Trade" | "Fee" | "Adjustment";
  detail: string;
  amount: string;
  symbol: string;
  at: Date;
};

/** Unified recent-activity feed from the append-only ledger (the real record of movements). */
export async function getRecentActivity(userId: string, take = 12): Promise<Activity[]> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    include: { asset: { select: { symbol: true } } },
  });

  const kindOf: Record<string, Activity["kind"]> = {
    DEPOSIT: "Deposit",
    WITHDRAWAL: "Withdrawal",
    TRADE_FILL: "Trade",
    FEE: "Fee",
    ADJUSTMENT: "Adjustment",
  };

  return entries.map((e) => ({
    kind: kindOf[e.type] ?? "Adjustment",
    detail: e.note ?? e.type.replace(/_/g, " ").toLowerCase(),
    amount: e.amount.toString(),
    symbol: e.asset.symbol,
    at: e.createdAt,
  }));
}
