import "server-only";

import { prisma, provisionWallet, type ProvisionedWallet } from "@tradynance/core";

function getMnemonic(): string {
  const mnemonic = process.env.HD_WALLET_MNEMONIC;
  if (!mnemonic) {
    throw new Error(
      "HD_WALLET_MNEMONIC is not set — cannot derive deposit addresses. See web/.env.example.",
    );
  }
  return mnemonic;
}

/**
 * Get-or-create the current user's wallet for an asset+network and derive its deposit
 * address if the network supports it. Idempotent — safe to call on every deposit-page load.
 */
export async function getOrCreateWallet(
  userId: string,
  assetId: string,
  network: string,
): Promise<ProvisionedWallet> {
  return provisionWallet(prisma, getMnemonic(), { userId, assetId, network });
}
