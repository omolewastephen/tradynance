// Proves verifyDepositTx against LIVE BTC testnet data (esplora). Picks a real confirmed tx,
// then asserts each verification outcome. Run: npx tsx packages/core/scripts/verify-check.ts
import { verifyDepositTx } from "../src/chain/verify.js";

const BASE = process.env.BTC_TESTNET_ESPLORA_URL ?? "https://blockstream.info/testnet/api";
const SATS = 100_000_000;

async function j<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json() as Promise<T>;
}
async function t(path: string): Promise<string> {
  const r = await fetch(`${BASE}${path}`);
  return (await r.text()).trim();
}

let pass = 0;
let fail = 0;
function assert(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
}

async function main() {
  // Find a real confirmed tx with an addressed output — scan back from the tip until we hit a
  // block with a suitable non-coinbase tx (testnet blocks are often nearly empty).
  const tipHeight = Number(await t("/blocks/tip/height"));
  let chosen: { txid: string; address: string; btc: string } | null = null;
  for (let h = tipHeight; h > tipHeight - 20 && !chosen; h--) {
    const hash = await t(`/block-height/${h}`);
    const txids = await j<string[]>(`/block/${hash}/txids`);
    for (const txid of txids.slice(1, 40)) {
      const tx = await j<{ vout: { scriptpubkey_address?: string; value: number }[] }>(`/tx/${txid}`);
      const out = tx.vout.find((o) => o.scriptpubkey_address && o.value > 0);
      if (out) { chosen = { txid, address: out.scriptpubkey_address!, btc: (out.value / SATS).toFixed(8) }; break; }
    }
  }
  if (!chosen) throw new Error("no suitable confirmed tx found in the last 20 blocks");
  console.log(`Using real testnet tx ${chosen.txid}\n  pays ${chosen.btc} BTC to ${chosen.address}\n`);

  // 1) exact match → verified
  const v = await verifyDepositTx({ network: "BTC_TESTNET", txHash: chosen.txid, toAddress: chosen.address, expectedAmount: chosen.btc });
  assert("exact amount → verified", v.status === "verified", JSON.stringify(v));
  assert("verified reports confirmations >= 1", v.status === "verified" && v.confirmations >= 1, JSON.stringify(v));
  assert("verified onchainAmount matches", v.status === "verified" && Number(v.onchainAmount) === Number(chosen.btc));

  // 2) claim more than was paid → amount_short
  const over = (Number(chosen.btc) + 1).toFixed(8);
  const short = await verifyDepositTx({ network: "BTC_TESTNET", txHash: chosen.txid, toAddress: chosen.address, expectedAmount: over });
  assert("claim > paid → amount_short", short.status === "amount_short", JSON.stringify(short));

  // 3) wrong destination → address_mismatch
  const wrong = await verifyDepositTx({ network: "BTC_TESTNET", txHash: chosen.txid, toAddress: "tb1qwrongaddressthatisnotinthetx0000000000", expectedAmount: chosen.btc });
  assert("wrong toAddress → address_mismatch", wrong.status === "address_mismatch", JSON.stringify(wrong));

  // 4) nonexistent txid → not_found
  const nf = await verifyDepositTx({ network: "BTC_TESTNET", txHash: "0000000000000000000000000000000000000000000000000000000000000000", toAddress: chosen.address, expectedAmount: chosen.btc });
  assert("fake txid → not_found", nf.status === "not_found", JSON.stringify(nf));

  // 5) no real txid / unsupported network
  const claimKey = await verifyDepositTx({ network: "BTC_TESTNET", txHash: "claim:abc", toAddress: chosen.address, expectedAmount: chosen.btc });
  assert("synthetic claim key → unsupported", claimKey.status === "unsupported");
  const unsup = await verifyDepositTx({ network: "SPOT", txHash: chosen.txid, toAddress: chosen.address, expectedAmount: chosen.btc });
  assert("non-chain network → unsupported", unsup.status === "unsupported");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
