import type { Metadata } from "next";

import { treasuryAddress, treasuryBalanceEth } from "@tradynance/core/chain";
import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES } from "@/lib/admin";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Treasury — Admin" };

function short(a: string) {
  return `${a.slice(0, 10)}…${a.slice(-8)}`;
}

// Best-effort live balance — never let a slow/absent RPC block the page.
async function balanceOrNull(): Promise<string | null> {
  try {
    return (await Promise.race([
      treasuryBalanceEth(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
    ])) as string;
  } catch {
    return null;
  }
}

export default async function TreasuryPage() {
  await requireRole(FINANCE_ROLES);

  let address: string | null = null;
  try {
    address = treasuryAddress();
  } catch {
    address = null; // mnemonic not configured
  }
  const balance = address ? await balanceOrNull() : null;
  const sweeps = await prisma.sweep.findMany({ orderBy: { createdAt: "desc" }, take: 50 });

  return (
    <div className="mx-auto flex w-full max-w-3xl animate-fade-rise flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Treasury</h1>
        <p className="text-sm text-foreground-muted">
          The platform hot/treasury wallet — deposits are swept here and withdrawals are paid from
          here. Sweeping is a custody move only; it never changes any user&apos;s ledger balance.
        </p>
      </div>

      <Card className="p-5">
        <div className="text-micro uppercase tracking-wide text-foreground-muted">
          Treasury address · ETH Sepolia
        </div>
        {address ? (
          <>
            <code className="mt-1 block break-all font-mono text-sm">{address}</code>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div>
                <div className="text-micro uppercase tracking-wide text-foreground-muted">On-chain balance</div>
                <div className="font-mono text-lg font-semibold tabular-nums">
                  {balance != null ? `${Number(balance).toFixed(6)} ETH` : "—"}
                </div>
              </div>
              <a
                href={`https://sepolia.etherscan.io/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:underline"
              >
                View on Etherscan →
              </a>
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-foreground-muted">
            Not configured — set <span className="font-mono">HD_WALLET_MNEMONIC</span> to derive the
            treasury wallet.
          </p>
        )}
        <p className="mt-4 text-xs text-foreground-muted">
          Derived on a reserved BIP-44 account (m/44&apos;/60&apos;/1&apos;/0/0), separate from
          per-user deposit addresses (account 0) so it can never collide with one.
        </p>
      </Card>

      <Card className="p-0">
        <div className="border-b border-border-subtle px-4 py-3 text-sm font-medium">
          Recent sweeps ({sweeps.length})
        </div>
        {sweeps.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-foreground-muted">
            No sweeps yet. The sweeper consolidates funded deposit addresses on a schedule.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-foreground-muted [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                  <th>When</th>
                  <th>From</th>
                  <th className="text-right">Amount</th>
                  <th>Tx</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-t [&>tr]:border-border-subtle">
                {sweeps.map((s) => (
                  <tr key={s.id} className="[&>td]:px-4 [&>td]:py-2.5">
                    <td className="whitespace-nowrap text-xs text-foreground-muted">{s.createdAt.toLocaleString()}</td>
                    <td className="font-mono text-xs">{short(s.fromAddress)}</td>
                    <td className="text-right font-mono tabular-nums">{Number(s.amount).toFixed(6)}</td>
                    <td>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${s.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-accent hover:underline"
                      >
                        {short(s.txHash)}
                      </a>
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
