"use client";

import { useState } from "react";
import { createWalletClient, custom, parseEther, isAddress, type Hex } from "viem";
import { sepolia } from "viem/chains";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// "Pay from your own wallet": connect a browser (EIP-1193 / injected, e.g. MetaMask) wallet with
// pure viem — no wagmi — and send the deposit straight to your custodial deposit address on
// Sepolia. The chain-watcher detects the incoming transfer and credits it through the same
// idempotent creditDeposit path as any other deposit, so this is only a nicer funding UX, not a
// new money path. WalletConnect (mobile/QR) is a follow-on: add @walletconnect/ethereum-provider
// behind NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID and feed its provider into the same viem client.

const SEPOLIA_CHAIN_HEX = "0xaa36a7"; // 11155111

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function PayWithWallet({ depositAddress, symbol }: { depositAddress: string; symbol: string }) {
  const [account, setAccount] = useState<string | null>(null);
  const [chainHex, setChainHex] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const eth =
    typeof window !== "undefined"
      ? ((window as unknown as { ethereum?: Eip1193 }).ethereum ?? undefined)
      : undefined;

  const wrongChain = !!chainHex && chainHex.toLowerCase() !== SEPOLIA_CHAIN_HEX;
  const amt = Number(amount) || 0;

  async function connect() {
    if (!eth) return;
    setError(null);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setAccount(accounts[0] ?? null);
      setChainHex((await eth.request({ method: "eth_chainId" })) as string);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function switchToSepolia() {
    if (!eth) return;
    setError(null);
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_HEX }] });
      setChainHex(SEPOLIA_CHAIN_HEX);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function pay() {
    if (!eth || !account || amt <= 0 || !isAddress(depositAddress)) return;
    setBusy(true);
    setError(null);
    try {
      const client = createWalletClient({ account: account as Hex, chain: sepolia, transport: custom(eth) });
      const hash = await client.sendTransaction({ to: depositAddress as Hex, value: parseEther(amount) });
      setTxHash(hash);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-border-subtle bg-surface-raised/40 p-4">
      <div className="mb-1 text-sm font-medium">Pay from your wallet</div>
      <p className="mb-3 text-xs text-foreground-muted">
        Send {symbol} straight from a connected wallet to your deposit address — it&apos;s credited
        automatically once confirmed on-chain.
      </p>

      {!eth ? (
        <p className="text-xs text-foreground-muted">
          No browser wallet detected. Install MetaMask (or another EIP-1193 wallet) to pay directly,
          or send manually to the address above.
        </p>
      ) : !account ? (
        <button
          onClick={connect}
          className="rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Connect wallet
        </button>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-foreground-muted">{short(account)}</span>
            <button onClick={() => setAccount(null)} className="text-foreground-muted hover:text-danger">
              Disconnect
            </button>
          </div>

          {wrongChain ? (
            <button
              onClick={switchToSepolia}
              className="rounded-sm border border-warning/50 py-2 text-sm text-warning transition-colors hover:bg-warning/10"
            >
              Switch wallet to Sepolia
            </button>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder={`Amount (${symbol})`}
                  className="h-9 font-mono text-sm"
                />
                <button
                  onClick={pay}
                  disabled={busy || amt <= 0}
                  className="shrink-0 rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Send"}
                </button>
              </div>
              <p className="text-[11px] text-foreground-muted">
                To <span className="font-mono">{short(depositAddress)}</span> · Sepolia
              </p>
            </>
          )}

          {txHash && (
            <p className="text-xs text-price-up">
              Sent — tx <span className="font-mono">{short(txHash)}</span>. Crediting on confirmation.
            </p>
          )}
        </div>
      )}

      {error && <p className={cn("mt-2 text-xs text-danger")}>{error.slice(0, 140)}</p>}
    </div>
  );
}
