import { prisma } from "../src/lib/prisma";

// The coin catalog from the spec. `networks` lists each chain the coin can move on.
// Only BTC_TESTNET and ETH_SEPOLIA are "derivable" (see DERIVATION_CONFIGS in
// packages/core) — everything else is a catalog entry with no live deposit address yet, so
// users can see the asset but provisioning returns a null address until we wire that chain.
type SeedNetwork = {
  network: string;
  minDeposit: string;
  withdrawalFee: string;
  requiresMemo?: boolean;
  contractAddress?: string;
  // Central/shared deposit address shown to every user (the shared-custodial model). Seeded only
  // for BTC + ETH as SAMPLES — replace them, and fill in the other coins, from Admin → Assets.
  depositAddress?: string;
};

type SeedAsset = {
  symbol: string;
  name: string;
  decimals: number;
  networks: SeedNetwork[];
};

const ASSETS: SeedAsset[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    decimals: 8,
    networks: [
      {
        network: "BTC_TESTNET",
        minDeposit: "0.0001",
        withdrawalFee: "0.00005",
        // SAMPLE testnet address — replace with your real custody address in Admin → Assets.
        depositAddress: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
      },
    ],
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    networks: [
      {
        network: "ETH_SEPOLIA",
        minDeposit: "0.001",
        withdrawalFee: "0.0005",
        // SAMPLE address — replace with your real custody address in Admin → Assets.
        depositAddress: "0x000000000000000000000000000000000000dEaD",
      },
    ],
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    networks: [
      { network: "ERC20", minDeposit: "1", withdrawalFee: "1" },
      { network: "TRC20", minDeposit: "1", withdrawalFee: "1" },
    ],
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    networks: [{ network: "ERC20", minDeposit: "1", withdrawalFee: "1" }],
  },
  {
    symbol: "BNB",
    name: "BNB",
    decimals: 18,
    networks: [{ network: "BEP20", minDeposit: "0.01", withdrawalFee: "0.005" }],
  },
  {
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    networks: [{ network: "SOL", minDeposit: "0.05", withdrawalFee: "0.01" }],
  },
  {
    symbol: "XRP",
    name: "XRP",
    decimals: 6,
    networks: [{ network: "XRP", minDeposit: "1", withdrawalFee: "0.25", requiresMemo: true }],
  },
  {
    symbol: "DOGE",
    name: "Dogecoin",
    decimals: 8,
    networks: [{ network: "DOGE", minDeposit: "10", withdrawalFee: "5" }],
  },
  {
    symbol: "TRX",
    name: "TRON",
    decimals: 6,
    networks: [{ network: "TRC20", minDeposit: "10", withdrawalFee: "1" }],
  },
  {
    symbol: "LTC",
    name: "Litecoin",
    decimals: 8,
    networks: [{ network: "LTC", minDeposit: "0.01", withdrawalFee: "0.001" }],
  },
  {
    symbol: "TON",
    name: "Toncoin",
    decimals: 9,
    networks: [{ network: "TON", minDeposit: "0.5", withdrawalFee: "0.1", requiresMemo: true }],
  },
  {
    symbol: "ADA",
    name: "Cardano",
    decimals: 6,
    networks: [{ network: "ADA", minDeposit: "5", withdrawalFee: "1" }],
  },
  {
    symbol: "MATIC",
    name: "Polygon",
    decimals: 18,
    networks: [{ network: "POLYGON", minDeposit: "1", withdrawalFee: "0.1" }],
  },
  {
    symbol: "AVAX",
    name: "Avalanche",
    decimals: 18,
    networks: [{ network: "AVAX_C", minDeposit: "0.1", withdrawalFee: "0.01" }],
  },
  {
    symbol: "BCH",
    name: "Bitcoin Cash",
    decimals: 8,
    networks: [{ network: "BCH", minDeposit: "0.01", withdrawalFee: "0.001" }],
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    decimals: 18,
    networks: [{ network: "ERC20", minDeposit: "0.5", withdrawalFee: "0.1" }],
  },
];

export async function seedAssets() {
  for (const asset of ASSETS) {
    const record = await prisma.asset.upsert({
      where: { symbol: asset.symbol },
      create: { symbol: asset.symbol, name: asset.name, decimals: asset.decimals },
      update: { name: asset.name, decimals: asset.decimals },
    });

    for (const net of asset.networks) {
      await prisma.assetNetwork.upsert({
        where: { assetId_network: { assetId: record.id, network: net.network } },
        create: {
          assetId: record.id,
          network: net.network,
          minDeposit: net.minDeposit,
          withdrawalFee: net.withdrawalFee,
          requiresMemo: net.requiresMemo ?? false,
          contractAddress: net.contractAddress,
          depositAddress: net.depositAddress,
        },
        update: {
          minDeposit: net.minDeposit,
          withdrawalFee: net.withdrawalFee,
          requiresMemo: net.requiresMemo ?? false,
          contractAddress: net.contractAddress,
          // Only set the sample address on first seed; don't clobber an admin-set address on re-seed.
          ...(net.depositAddress ? { depositAddress: net.depositAddress } : {}),
        },
      });
    }
  }

  const assetCount = await prisma.asset.count();
  const netCount = await prisma.assetNetwork.count();
  console.log(`[seed] assets: ${assetCount}, networks: ${netCount}`);
}
