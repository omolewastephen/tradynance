// Tradynance chain-watcher — standalone long-running process (NOT a Next.js route).
// Polls BTC testnet (esplora) and ETH Sepolia (viem block scan) for deposits into
// provisioned addresses and credits them through the shared, idempotent ledger function
// in @tradynance/core. See CLAUDE.md for why this lives outside the Next.js app.

import { config } from "./config.js";
import { scanBtc } from "./btc.js";
import { scanEvm } from "./evm.js";

let running = true;

async function tick(): Promise<void> {
  // Networks are scanned independently; one failing shouldn't stop the other.
  const results = await Promise.allSettled([scanBtc(), scanEvm()]);
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[watcher] scan failed:", r.reason?.message ?? r.reason);
    }
  }
}

async function main(): Promise<void> {
  console.log(
    `[watcher] starting — BTC(${config.btc.network}) + ETH(${config.eth.network}), ` +
      `poll every ${config.pollIntervalMs}ms`,
  );

  process.on("SIGINT", () => {
    console.log("[watcher] shutting down");
    running = false;
  });
  process.on("SIGTERM", () => {
    running = false;
  });

  while (running) {
    const started = Date.now();
    await tick();
    const elapsed = Date.now() - started;
    const wait = Math.max(0, config.pollIntervalMs - elapsed);
    await new Promise((r) => setTimeout(r, wait));
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[watcher] fatal:", err);
  process.exit(1);
});
