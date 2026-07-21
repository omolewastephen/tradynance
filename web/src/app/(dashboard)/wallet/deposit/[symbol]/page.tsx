import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/wallet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CoinIcon } from "@/components/brand/coin-icon";
import { PayWithWalletLoader } from "@/components/web3/pay-with-wallet-loader";
import { CopyAddress } from "./copy-address";
import { ClaimForm } from "./claim-form";

// Networks where "pay from your own wallet" (wagmi/Sepolia) applies.
const WEB3_PAY_NETWORKS = new Set(["ETH_SEPOLIA"]);

export default async function DepositPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ network?: string }>;
}) {
  const session = await requireUser();
  const { symbol } = await params;
  const { network: requestedNetwork } = await searchParams;

  const asset = await prisma.asset.findUnique({
    where: { symbol: symbol.toUpperCase() },
    include: { networks: { where: { isActive: true }, orderBy: { network: "asc" } } },
  });
  if (!asset || asset.networks.length === 0) notFound();

  // Selected network: query param if valid, else the first one.
  const selected =
    asset.networks.find((n) => n.network === requestedNetwork) ?? asset.networks[0];

  const wallet = await getOrCreateWallet(session.user.id, asset.id, selected.network);

  // An admin-set platform address (from /admin/assets) takes precedence over the per-user
  // derived address — the shared-custodial model. Falls back to the derived address when unset.
  const depositAddress = selected.depositAddress ?? wallet.depositAddress;
  const depositMemo = selected.depositMemo; // admin-set memo/tag for the platform address

  const qrDataUrl = depositAddress
    ? await QRCode.toDataURL(depositAddress, { margin: 1, width: 220 })
    : null;

  const recentDeposits = await prisma.deposit.findMany({
    where: { userId: session.user.id, assetId: asset.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <div>
        <Link href="/wallet" className="text-sm text-accent hover:underline">
          ← Wallet
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <CoinIcon symbol={asset.symbol} size={40} />
          <div>
            <h1 className="font-display text-h1 leading-none tracking-tight">
              Deposit {asset.symbol}
            </h1>
            <p className="text-foreground-muted">{asset.name}</p>
          </div>
        </div>
      </div>

      {asset.networks.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-foreground-muted">Network:</span>
          {asset.networks.map((n) => (
            <Link
              key={n.network}
              href={`/wallet/deposit/${asset.symbol}?network=${n.network}`}
              className={
                "rounded-sm border px-3 py-1 text-sm transition-colors " +
                (n.network === selected.network
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground-muted hover:text-foreground")
              }
            >
              {n.network}
            </Link>
          ))}
        </div>
      )}

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>
            {asset.symbol} deposit address · {selected.network}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {depositAddress ? (
            <>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                {qrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL, not an optimizable asset
                  <img
                    src={qrDataUrl}
                    alt={`${asset.symbol} deposit address QR`}
                    className="size-40 rounded-md border border-border-subtle bg-white p-1"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="text-micro uppercase tracking-wide text-foreground-muted">
                    Address
                  </span>
                  <code className="break-all rounded-sm border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-sm">
                    {depositAddress}
                  </code>
                  <CopyAddress value={depositAddress} />
                  {depositMemo && (
                    <div className="mt-1 flex flex-col gap-1">
                      <span className="text-micro uppercase tracking-wide text-foreground-muted">Memo / tag</span>
                      <code className="break-all rounded-sm border border-warning/30 bg-warning/10 px-3 py-2 font-mono text-sm text-warning">
                        {depositMemo}
                      </code>
                    </div>
                  )}
                </div>
              </div>

              {selected.requiresMemo && (
                <p className="rounded-sm border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                  This network requires a memo/tag. You must include the memo shown above when
                  sending — a transfer without it may be unrecoverable.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <span className="text-foreground-muted">Minimum deposit</span>
                <span className="text-right font-mono tabular-nums">
                  {selected.minDeposit.toString()} {asset.symbol}
                </span>
                <span className="text-foreground-muted">Network</span>
                <span className="text-right font-mono">{selected.network}</span>
              </div>

              <p className="text-xs text-foreground-muted">
                Send only {asset.symbol} on the {selected.network} network to this address. After
                sending, submit the deposit below — your balance is credited once we confirm the
                funds have arrived.
              </p>

              {WEB3_PAY_NETWORKS.has(selected.network) && (
                <PayWithWalletLoader depositAddress={depositAddress} symbol={asset.symbol} />
              )}
            </>
          ) : (
            <p className="rounded-sm border border-border-subtle bg-surface-raised px-3 py-3 text-sm text-foreground-muted">
              Automated deposits for the {selected.network} network aren&apos;t enabled yet.
              This asset is listed, but a live deposit address will appear here once that
              chain is integrated. In the meantime, contact support to arrange a deposit.
            </p>
          )}
        </CardContent>
      </Card>

      {depositAddress && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Confirm your deposit</CardTitle>
          </CardHeader>
          <CardContent>
            <ClaimForm
              assetSymbol={asset.symbol}
              network={selected.network}
              toAddress={depositAddress}
            />
          </CardContent>
        </Card>
      )}

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Recent {asset.symbol} deposits</CardTitle>
        </CardHeader>
        <CardContent>
          {recentDeposits.length === 0 ? (
            <p className="text-sm text-foreground-muted">No deposits yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {recentDeposits.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between border-b border-border-subtle py-2 text-sm last:border-0"
                >
                  <span className="font-mono tabular-nums">
                    {d.amount.toString()} {asset.symbol}
                  </span>
                  <span className="text-xs text-foreground-muted">{d.status}</span>
                  <span className="text-xs text-foreground-muted">
                    {d.createdAt.toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
