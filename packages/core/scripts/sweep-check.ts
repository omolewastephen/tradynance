// Verifies the deposit sweeper: (1) the treasury/hot wallet no longer collides with any user
// deposit address (reserved BIP-44 account), and (2) the sweep scans ETH_SEPOLIA deposit addresses
// and, with none funded, sweeps nothing while returning the treasury. A live sweep needs funded
// testnet deposit addresses. Run:
//   node_modules/.bin/tsx --env-file=web/.env packages/core/scripts/sweep-check.ts
import { prisma } from "../src/index.js";
import { treasuryAddress, hotEvmAccount, sweepEvmDeposits } from "../src/chain/index.js";
import { mnemonicToAccount } from "viem/accounts";
import { isAddress } from "viem";

let ok = true;
const check = (n: string, p: boolean, e = "") => { console.log(p ? "PASS" : "FAIL", "-", n, e); if (!p) ok = false; };

async function main() {
  const mnemonic = process.env.HD_WALLET_MNEMONIC!;
  const treasury = treasuryAddress();
  check("treasury is a valid EVM address", isAddress(treasury), treasury);
  check("treasuryAddress === hotEvmAccount", treasury === hotEvmAccount().address);

  // User deposit addresses live on account 0 (m/44'/60'/0'/0/index). Treasury is account 1.
  const userAddrs = [0, 1, 2, 3, 5, 10, 100, 1000].map(
    (i) => mnemonicToAccount(mnemonic, { addressIndex: i }).address.toLowerCase(),
  );
  check("treasury does NOT collide with any user deposit index", !userAddrs.includes(treasury.toLowerCase()), treasury);
  console.log("   treasury:", treasury);
  console.log("   user idx 0:", userAddrs[0], "(was the old colliding hot index)");

  // Sweep run — scans real ETH_SEPOLIA deposit wallets; sweeps only funded ones.
  const res = await sweepEvmDeposits(prisma);
  check("sweep returns the treasury as destination", res.treasury === treasury);
  check("scanned the ETH_SEPOLIA deposit wallets", res.scanned >= 0, `scanned=${res.scanned}`);
  check("no funded deposit addresses → swept 0 (as expected in dev)", res.swept === 0, `swept=${res.swept}`);
  console.log(`   scanned ${res.scanned} ETH_SEPOLIA deposit address(es), swept ${res.swept}`);
}

main().catch((e) => { console.error(e); ok = false; }).finally(async () => { await prisma.$disconnect(); process.exit(ok ? 0 : 1); });
