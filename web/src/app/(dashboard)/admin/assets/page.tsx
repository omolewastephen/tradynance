import type { Metadata } from "next";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { CoinIcon } from "@/components/brand/coin-icon";
import { NetworkEditor, type NetworkVM } from "./network-editor";

export const metadata: Metadata = { title: "Assets — Admin" };

export default async function AdminAssetsPage() {
  await requireRole(FINANCE_ROLES);

  const assets = await prisma.asset.findMany({
    include: { networks: { orderBy: { network: "asc" } } },
    orderBy: { symbol: "asc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl animate-fade-rise flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Assets</h1>
        <p className="text-sm text-foreground-muted">
          Set the platform deposit address and network config for each coin. When a deposit address
          is set, users see it instead of a per-user derived address.
        </p>
      </div>

      {assets.map((a) => (
        <Card key={a.id} className="p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <CoinIcon symbol={a.symbol} size={26} />
            <div>
              <div className="text-sm font-semibold">{a.symbol}</div>
              <div className="text-xs text-foreground-muted">{a.name}</div>
            </div>
          </div>
          {a.networks.length === 0 ? (
            <p className="text-xs text-foreground-muted">No networks configured.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {a.networks.map((n) => {
                const vm: NetworkVM = {
                  id: n.id,
                  network: n.network,
                  depositAddress: n.depositAddress ?? "",
                  depositMemo: n.depositMemo ?? "",
                  minDeposit: n.minDeposit.toString(),
                  withdrawalFee: n.withdrawalFee.toString(),
                  requiresMemo: n.requiresMemo,
                  isActive: n.isActive,
                };
                return <NetworkEditor key={n.id} net={vm} />;
              })}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
