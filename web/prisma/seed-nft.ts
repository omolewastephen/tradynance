import { Prisma } from "@tradynance/core";
import { prisma } from "../src/lib/prisma";

const D = (n: string) => new Prisma.Decimal(n);

const CREATOR_EMAIL = "nft-creator@tradynance.system";
const COLLECTION = { name: "Tradynance Genesis", symbol: "TGEN", description: "The founding Tradynance generative collection — 8 unique on-chain pieces." };

const NFTS = [
  { name: "Aurora #01", price: "120" },
  { name: "Nebula #02", price: "85" },
  { name: "Prism #03", price: "240" },
  { name: "Flux #04", price: "60" },
  { name: "Vertex #05", price: "150" },
  { name: "Halcyon #06", price: "310" },
  { name: "Cipher #07", price: "95" },
  { name: "Zenith #08", price: "180" },
];

export async function seedNft() {
  // System creator that mints + lists the founding collection.
  let creator = await prisma.user.findUnique({ where: { email: CREATOR_EMAIL } });
  if (!creator) {
    creator = await prisma.user.create({
      data: {
        email: CREATOR_EMAIL, username: "nft_creator", displayUsername: "Tradynance Studio",
        emailVerified: true, referralCode: "TGENSTUDIO1",
      },
    });
  }

  const existing = await prisma.nftCollection.findUnique({ where: { symbol: COLLECTION.symbol } });
  if (existing) {
    console.log("[seed] nft collection already exists");
    return;
  }

  const collection = await prisma.nftCollection.create({ data: COLLECTION });
  for (let i = 0; i < NFTS.length; i++) {
    const meta = NFTS[i];
    const nft = await prisma.nft.create({
      data: {
        collectionId: collection.id,
        tokenId: i + 1,
        name: meta.name,
        imageSeed: `${COLLECTION.symbol}-${i + 1}-${meta.name}`,
        ownerId: creator.id,
      },
    });
    await prisma.nftListing.create({ data: { nftId: nft.id, sellerId: creator.id, price: D(meta.price) } });
  }
  console.log(`[seed] nft: collection ${COLLECTION.symbol} + ${NFTS.length} listed NFTs`);
}
