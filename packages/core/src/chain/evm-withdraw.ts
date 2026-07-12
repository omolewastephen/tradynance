// Real on-chain withdrawal broadcast for EVM (Ethereum Sepolia testnet). Signs a native-ETH
// transfer from the custodial HOT wallet — derived at a dedicated index of the same
// HD_WALLET_MNEMONIC used for deposit addresses — and broadcasts it via the Sepolia RPC, returning
// the real transaction hash. viem handles nonce + gas estimation.
//
// TESTNET ONLY here (per CLAUDE.md convention #5 — prove against testnets before real money). The
// hot wallet must hold Sepolia ETH; an unfunded wallet fails at broadcast with an insufficient-
// funds error (surfaced to the caller, ledger untouched). ERC-20 token transfers are deferred —
// native ETH only for now.

import { createWalletClient, http, parseEther, isAddress, type Hex } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

// The hot wallet lives at a dedicated address index, kept clear of user deposit indexes.
const HOT_INDEX = Number(process.env.HOT_WALLET_INDEX ?? 0);

/** The custodial hot-wallet signing account (throws if the mnemonic isn't configured). */
export function hotEvmAccount() {
  const mnemonic = process.env.HD_WALLET_MNEMONIC;
  if (!mnemonic) throw new Error("HD_WALLET_MNEMONIC is not set");
  return mnemonicToAccount(mnemonic, { addressIndex: HOT_INDEX });
}

export interface EvmBroadcastInput {
  to: string;
  amountEth: string; // human units (ETH); parsed to wei
  rpcUrl?: string;
}

/** Sign + broadcast a native-ETH transfer on Sepolia. Returns the on-chain tx hash. */
export async function broadcastEvmWithdrawal(
  input: EvmBroadcastInput,
): Promise<{ txHash: string; from: string }> {
  if (!isAddress(input.to)) throw new Error(`Invalid EVM address: ${input.to}`);
  const value = parseEther(input.amountEth);
  if (value <= BigInt(0)) throw new Error("Amount must be positive");

  const account = hotEvmAccount();
  const rpcUrl = input.rpcUrl ?? process.env.ETH_SEPOLIA_RPC_URL;
  const client = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });

  const txHash = await client.sendTransaction({
    to: input.to as Hex,
    value,
  });
  return { txHash, from: account.address };
}
