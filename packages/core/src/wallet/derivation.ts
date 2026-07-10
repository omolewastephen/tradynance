// Deterministic deposit-address derivation from a single BIP-39 mnemonic.
//
// COMPLIANCE / CUSTODY NOTE (see CLAUDE.md): a hot HD wallet like this holds the keys that
// control real user deposits. In production the mnemonic must come from a secrets manager
// (never a committed .env), and cold-storage sweeping of deposited funds is out of scope for
// this phase. This module derives *watch* addresses per user wallet; signing/withdrawal keys
// are the same tree but are only touched by the withdrawal worker in Phase 3.
//
// Each on-chain network has a stable BIP-44 coin type. We derive one address per
// (network, addressIndex) where addressIndex is the Wallet's monotonic `derivationIndex`,
// so a given wallet always maps to the same address and we never reuse an index across users.

import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import * as btc from "@scure/btc-signer";
import { mnemonicToAccount } from "viem/accounts";

export type ChainKind = "BTC" | "EVM";

export interface NetworkDerivationConfig {
  /** Network code as stored on AssetNetwork.network, e.g. "BTC_TESTNET", "ETH_SEPOLIA". */
  network: string;
  kind: ChainKind;
  /** BIP-44 coin type (1 = all testnets, 60 = ETH mainnet, 0 = BTC mainnet). */
  coinType: number;
  /** BTC-only: which @scure network params to encode addresses with. */
  btcNetwork?: "mainnet" | "testnet";
}

// Networks we actually derive live addresses for in this phase. Everything else in the coin
// list is a catalog entry with no deposit address yet (see seed).
//
// EVM uses coin type 60 even on testnets — an Ethereum address is identical across mainnet
// and Sepolia, so the conventional m/44'/60' path is correct and there's no tree to separate.
// BTC testnet uses coin type 1, the standard "all testnets" coin type.
export const DERIVATION_CONFIGS: Record<string, NetworkDerivationConfig> = {
  ETH_SEPOLIA: { network: "ETH_SEPOLIA", kind: "EVM", coinType: 60 },
  BTC_TESTNET: { network: "BTC_TESTNET", kind: "BTC", coinType: 1, btcNetwork: "testnet" },
};

function requireValidMnemonic(mnemonic: string): string {
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error("HD_WALLET_MNEMONIC is not a valid BIP-39 mnemonic");
  }
  return mnemonic;
}

function deriveEvmAddress(mnemonic: string, addressIndex: number): string {
  // Standard Ethereum path m/44'/60'/0'/0/${addressIndex} (viem's default tree).
  const account = mnemonicToAccount(mnemonic, { addressIndex });
  return account.address;
}

function deriveBtcAddress(
  mnemonic: string,
  coinType: number,
  addressIndex: number,
  btcNetwork: "mainnet" | "testnet",
): string {
  const seed = mnemonicToSeedSync(requireValidMnemonic(mnemonic));
  const root = HDKey.fromMasterSeed(seed);
  // BIP-84 native SegWit path: m/84'/coin'/0'/0/index
  const child = root.derive(`m/84'/${coinType}'/0'/0/${addressIndex}`);
  if (!child.publicKey) throw new Error("Failed to derive BTC public key");
  const net = btcNetwork === "testnet" ? btc.TEST_NETWORK : btc.NETWORK;
  const payment = btc.p2wpkh(child.publicKey, net);
  if (!payment.address) throw new Error("Failed to encode BTC address");
  return payment.address;
}

export interface DerivedAddress {
  network: string;
  address: string;
  derivationIndex: number;
}

/**
 * Derive the deposit address for a given network + monotonic wallet index.
 * Deterministic: same (mnemonic, network, index) always yields the same address.
 */
export function deriveDepositAddress(
  mnemonic: string,
  network: string,
  derivationIndex: number,
): DerivedAddress {
  const config = DERIVATION_CONFIGS[network];
  if (!config) {
    throw new Error(`No derivation config for network "${network}"`);
  }
  requireValidMnemonic(mnemonic);

  const address =
    config.kind === "EVM"
      ? deriveEvmAddress(mnemonic, derivationIndex)
      : deriveBtcAddress(
          mnemonic,
          config.coinType,
          derivationIndex,
          config.btcNetwork ?? "testnet",
        );

  return { network, address, derivationIndex };
}

export function isDerivableNetwork(network: string): boolean {
  return network in DERIVATION_CONFIGS;
}
