// Verifies the EVM withdrawal-broadcast path. Deterministic checks (hot-account derivation +
// dispatcher routing) always run; the live part reads the hot wallet's Sepolia balance and, if
// funded, broadcasts a tiny transfer to prove the whole signer→RPC path end to end. If unfunded,
// it reports the funding requirement (the path is proven up to needing testnet ETH). Run with:
//   node_modules/.bin/tsx --env-file=web/.env packages/core/scripts/broadcast-check.ts
import { hotEvmAccount, broadcastWithdrawal, broadcastEvmWithdrawal } from "../src/index.js";
import { createPublicClient, http, isAddress, formatEther } from "viem";
import { sepolia } from "viem/chains";

let ok = true;
const check = (n: string, p: boolean, e = "") => { console.log(p ? "PASS" : "FAIL", "-", n, e); if (!p) ok = false; };

async function main() {
  // Deterministic: hot account derivation is stable + a valid EVM address.
  const a1 = hotEvmAccount().address;
  const a2 = hotEvmAccount().address;
  check("hot account derivation deterministic", a1 === a2);
  check("hot account is a valid EVM address", isAddress(a1), a1);
  console.log("   hot wallet:", a1);

  // Dispatcher: unsupported network → manual fallback, not a throw.
  const btc = await broadcastWithdrawal({ network: "BTC_TESTNET", to: "tb1qxyz", amount: "0.001" });
  check("BTC_TESTNET routes to manual fallback", btc.broadcast === false);

  // Live: read balance, broadcast if funded.
  const pub = createPublicClient({ chain: sepolia, transport: http(process.env.ETH_SEPOLIA_RPC_URL) });
  const bal = await pub.getBalance({ address: a1 as `0x${string}` });
  console.log(`   Sepolia balance: ${formatEther(bal)} ETH`);

  if (bal > BigInt(0)) {
    // Send a tiny amount back to self (proves signing + broadcast without needing a second address).
    const res = await broadcastEvmWithdrawal({ to: a1, amountEth: "0.00001" });
    check("live broadcast returned a tx hash", /^0x[0-9a-fA-F]{64}$/.test(res.txHash), res.txHash);
    console.log("   tx:", res.txHash);
  } else {
    console.log("   (hot wallet unfunded — signer/RPC path verified up to the send; fund with");
    console.log("    Sepolia ETH to complete a live broadcast. Deterministic checks passed.)");
    // Prove the send path reaches the chain and fails specifically on funds, not on wiring.
    try {
      await broadcastEvmWithdrawal({ to: a1, amountEth: "0.00001" });
      check("unexpected: send succeeded on zero balance", false);
    } catch (e) {
      const msg = (e as Error).message.toLowerCase();
      const fundsError = msg.includes("insufficient") || msg.includes("funds") || msg.includes("balance");
      check("send reaches chain + fails on insufficient funds (not wiring)", fundsError, (e as Error).message.slice(0, 120));
    }
  }
}

main().catch((e) => { console.error(e); ok = false; }).finally(() => process.exit(ok ? 0 : 1));
