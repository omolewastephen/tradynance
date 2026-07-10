// Env config for the chain-watcher. Reads from process.env (loaded from web/.env in dev via
// the --env-file flag in package.json, or the ambient environment in production).

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (Number.isNaN(n)) throw new Error(`Env var ${name} must be a number, got "${raw}"`);
  return n;
}

export const config = {
  pollIntervalMs: num("CHAIN_WATCHER_POLL_MS", 15_000),
  btc: {
    network: "BTC_TESTNET",
    esploraUrl: process.env.BTC_TESTNET_ESPLORA_URL ?? "https://blockstream.info/testnet/api",
    minConfirmations: num("DEPOSIT_MIN_CONFIRMATIONS_BTC", 1),
  },
  eth: {
    network: "ETH_SEPOLIA",
    rpcUrl:
      process.env.ETH_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
    minConfirmations: num("DEPOSIT_MIN_CONFIRMATIONS_ETH", 3),
    // How many recent blocks to re-scan each poll. Must comfortably exceed
    // minConfirmations so a tx is credited before it falls out of the window.
    lookbackBlocks: num("ETH_SEPOLIA_LOOKBACK_BLOCKS", 20),
  },
};

export { required };
