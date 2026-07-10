import { deriveDepositAddress } from "../src/wallet/derivation.js";

// Standard BIP-39 test vector for a determinism check (NOT a real wallet).
const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const eth0 = deriveDepositAddress(MNEMONIC, "ETH_SEPOLIA", 0);
const eth1 = deriveDepositAddress(MNEMONIC, "ETH_SEPOLIA", 1);
const eth0again = deriveDepositAddress(MNEMONIC, "ETH_SEPOLIA", 0);
const btc0 = deriveDepositAddress(MNEMONIC, "BTC_TESTNET", 0);
const btc1 = deriveDepositAddress(MNEMONIC, "BTC_TESTNET", 1);
const btc0again = deriveDepositAddress(MNEMONIC, "BTC_TESTNET", 0);

console.log("ETH[0]:", eth0.address);
console.log("ETH[1]:", eth1.address);
console.log("BTC[0]:", btc0.address);
console.log("BTC[1]:", btc1.address);

const checks: Record<string, boolean> = {
  "ETH determinism": eth0.address === eth0again.address,
  "ETH distinct indexes": eth0.address !== eth1.address,
  "ETH valid format": /^0x[0-9a-fA-F]{40}$/.test(eth0.address),
  "BTC determinism": btc0.address === btc0again.address,
  "BTC distinct indexes": btc0.address !== btc1.address,
  "BTC testnet bech32": btc0.address.startsWith("tb1"),
};

let ok = true;
for (const [name, pass] of Object.entries(checks)) {
  console.log(pass ? "PASS" : "FAIL", "-", name);
  if (!pass) ok = false;
}

try {
  deriveDepositAddress(MNEMONIC, "DOGE", 0);
  console.log("FAIL - should reject unknown network");
  ok = false;
} catch {
  console.log("PASS - rejects unknown network");
}

process.exit(ok ? 0 : 1);
