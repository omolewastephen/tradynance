// Tradynance deposit sweeper — standalone custody service. Periodically consolidates deposits
// sitting on per-user derived addresses into the platform treasury/hot wallet (the same wallet
// that pays withdrawals). Thin loop over the core sweep function, like the other services.
//
// Inert without HD_WALLET_MNEMONIC + ETH_SEPOLIA_RPC_URL. TESTNET ONLY — it moves real (testnet)
// value, so it only acts on addresses that actually hold funds. Sweeping never touches the ledger
// (users are credited at deposit time); it records Sweep rows for the audit trail.

import { prisma } from "@tradynance/core";
import { sweepEvmDeposits } from "@tradynance/core/chain";

const POLL_MS = Number(process.env.SWEEP_POLL_MS ?? 5 * 60_000); // every 5 minutes

let running = true;

async function tick(): Promise<void> {
  if (!process.env.HD_WALLET_MNEMONIC || !process.env.ETH_SEPOLIA_RPC_URL) return;
  const res = await sweepEvmDeposits(prisma);
  if (res.swept > 0) {
    console.log(`[sweeper] swept ${res.swept}/${res.scanned} ETH_SEPOLIA deposit(s) → ${res.treasury}`);
    for (const e of res.entries) console.log(`[sweeper]   ${e.amountEth} ETH from ${e.from} (tx ${e.txHash})`);
  }
}

async function main(): Promise<void> {
  console.log(`[sweeper] starting — sweep every ${POLL_MS}ms (ETH_SEPOLIA)`);
  process.on("SIGINT", () => { running = false; });
  process.on("SIGTERM", () => { running = false; });
  while (running) {
    const started = Date.now();
    try {
      await tick();
    } catch (err) {
      console.error("[sweeper] tick failed:", (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, Math.max(0, POLL_MS - (Date.now() - started))));
  }
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[sweeper] fatal:", err);
  process.exit(1);
});
