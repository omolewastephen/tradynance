// Network-agnostic entry point for broadcasting an approved withdrawal on-chain. Routes to the
// per-chain implementation; returns { broadcast: false } for networks without one so the caller
// can fall back to the manual admin-provided-tx-hash settlement path (e.g. BTC_TESTNET, whose
// UTXO/PSBT flow isn't implemented yet).

import { broadcastEvmWithdrawal } from "./evm-withdraw.js";

export type BroadcastResult =
  | { broadcast: true; txHash: string; from: string }
  | { broadcast: false; reason: string };

const EVM_NETWORKS = new Set(["ETH_SEPOLIA"]);

export async function broadcastWithdrawal(input: {
  network: string;
  to: string;
  amount: string; // human units of the asset
}): Promise<BroadcastResult> {
  if (EVM_NETWORKS.has(input.network)) {
    const { txHash, from } = await broadcastEvmWithdrawal({ to: input.to, amountEth: input.amount });
    return { broadcast: true, txHash, from };
  }
  return {
    broadcast: false,
    reason: `On-chain broadcast is not implemented for ${input.network}; settle with a tx hash manually.`,
  };
}
