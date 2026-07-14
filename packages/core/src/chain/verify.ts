// On-chain verification of a user-submitted deposit claim: given a txid + the address the user was
// told to send to + the amount they claim, ask the chain whether that transfer actually happened.
// Turns a "trust me, I paid" claim into a provable one so an admin can approve obvious ones safely.
//
// Only the two integrated testnets can be checked (BTC testnet via esplora, ETH Sepolia via viem);
// every other coin/network returns "unsupported" and stays a manual admin decision — consistent
// with CLAUDE.md #5 (prove against testnets before treating a path as production-ready). Native
// transfers only (ERC-20 log parsing is deferred like elsewhere).

import { createPublicClient, http, formatEther, getAddress, isAddress } from "viem";
import { sepolia } from "viem/chains";

export type DepositVerification =
  | { status: "verified"; onchainAmount: string; confirmations: number }
  // Tx pays the right address but for less than the claimed amount.
  | { status: "amount_short"; onchainAmount: string; confirmations: number }
  // Tx exists but doesn't pay the expected deposit address.
  | { status: "address_mismatch"; detail: string }
  | { status: "not_found" }
  // Network isn't verifiable (no integration) or no real txid was supplied.
  | { status: "unsupported" }
  | { status: "error"; detail: string };

export interface VerifyDepositInput {
  network: string;
  txHash: string;
  toAddress: string;
  expectedAmount: string;
}

const SATS_PER_BTC = 100_000_000;
// Tiny epsilon so floating-point rounding on the last satoshi/wei doesn't read as a shortfall.
const AMOUNT_EPSILON = 1e-9;

function esploraBase(): string {
  return process.env.BTC_TESTNET_ESPLORA_URL ?? "https://blockstream.info/testnet/api";
}

interface EsploraTx {
  vout: { scriptpubkey_address?: string; value: number }[];
  status: { confirmed: boolean; block_height?: number };
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number; body?: T }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, status: res.status, body: (await res.json()) as T };
  } finally {
    clearTimeout(timer);
  }
}

async function verifyBtc(input: VerifyDepositInput): Promise<DepositVerification> {
  const base = esploraBase();
  const tx = await fetchJson<EsploraTx>(`${base}/tx/${input.txHash}`);
  if (tx.status === 404) return { status: "not_found" };
  if (!tx.ok || !tx.body) return { status: "error", detail: `esplora tx lookup ${tx.status}` };

  let sats = 0;
  for (const out of tx.body.vout ?? []) {
    if (out.scriptpubkey_address === input.toAddress) sats += out.value;
  }
  if (sats === 0) {
    return { status: "address_mismatch", detail: `tx has no output paying ${input.toAddress}` };
  }
  const onchainAmount = (sats / SATS_PER_BTC).toFixed(8);

  let confirmations = 0;
  if (tx.body.status?.confirmed && tx.body.status.block_height) {
    const tipRes = await fetch(`${base}/blocks/tip/height`).catch(() => null);
    const tip = tipRes && tipRes.ok ? Number((await tipRes.text()).trim()) : NaN;
    if (Number.isFinite(tip)) confirmations = tip - tx.body.status.block_height + 1;
  }

  if (Number(onchainAmount) + AMOUNT_EPSILON < Number(input.expectedAmount)) {
    return { status: "amount_short", onchainAmount, confirmations };
  }
  return { status: "verified", onchainAmount, confirmations };
}

async function verifyEvm(input: VerifyDepositInput): Promise<DepositVerification> {
  const rpc = process.env.ETH_SEPOLIA_RPC_URL;
  if (!rpc) return { status: "unsupported" };
  if (!isAddress(input.toAddress)) return { status: "address_mismatch", detail: "invalid destination address" };

  const client = createPublicClient({ chain: sepolia, transport: http(rpc) });

  let tx;
  try {
    tx = await client.getTransaction({ hash: input.txHash as `0x${string}` });
  } catch {
    return { status: "not_found" };
  }
  if (!tx) return { status: "not_found" };

  if (!tx.to || getAddress(tx.to) !== getAddress(input.toAddress)) {
    return { status: "address_mismatch", detail: `tx pays ${tx.to ?? "a contract"}, not ${input.toAddress}` };
  }

  const onchainAmount = formatEther(tx.value);
  let confirmations = 0;
  if (tx.blockNumber != null) {
    const tip = await client.getBlockNumber().catch(() => null);
    if (tip != null) confirmations = Number(tip - tx.blockNumber + BigInt(1));
  }

  if (Number(onchainAmount) + AMOUNT_EPSILON < Number(input.expectedAmount)) {
    return { status: "amount_short", onchainAmount, confirmations };
  }
  return { status: "verified", onchainAmount, confirmations };
}

/** True when a network can be verified on-chain (i.e. verifyDepositTx can do more than "unsupported"). */
export function isVerifiableNetwork(network: string): boolean {
  return network === "BTC_TESTNET" || network === "ETH_SEPOLIA";
}

/**
 * Best-effort on-chain verification. Never throws — returns a typed outcome the caller can act on
 * (auto-confirm on "verified", flag on mismatch, leave pending on error/unsupported).
 */
export async function verifyDepositTx(input: VerifyDepositInput): Promise<DepositVerification> {
  // A synthetic "claim:*" key means the user gave no real txid — nothing to check.
  if (!input.txHash || input.txHash.startsWith("claim:")) return { status: "unsupported" };
  try {
    if (input.network === "BTC_TESTNET") return await verifyBtc(input);
    if (input.network === "ETH_SEPOLIA") return await verifyEvm(input);
    return { status: "unsupported" };
  } catch (e) {
    return { status: "error", detail: (e as Error).message };
  }
}
