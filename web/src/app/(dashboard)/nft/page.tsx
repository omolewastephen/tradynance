import type { Metadata } from "next";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { NftClient, type ListingVM, type OwnedVM } from "./nft-client";

export const metadata: Metadata = { title: "NFT Marketplace — Tradynance" };

const SPOT = "SPOT";

export default async function NftPage() {
  const session = await requireUser();

  const [listings, owned, usdt] = await Promise.all([
    prisma.nftListing.findMany({
      where: { status: "ACTIVE" },
      include: {
        nft: { include: { collection: { select: { name: true, symbol: true } } } },
        seller: { select: { id: true, displayUsername: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.nft.findMany({
      where: { ownerId: session.user.id },
      include: {
        collection: { select: { name: true, symbol: true } },
        listings: { where: { status: "ACTIVE" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.asset.findUnique({ where: { symbol: "USDT" } }),
  ]);

  const wallet = usdt
    ? await prisma.wallet.findFirst({
        where: { userId: session.user.id, assetId: usdt.id, network: SPOT },
        select: { balance: true, lockedBalance: true },
      })
    : null;
  const available = wallet ? Number(wallet.balance) - Number(wallet.lockedBalance) : 0;

  const listingVMs: ListingVM[] = listings.map((l) => ({
    listingId: l.id,
    nftId: l.nftId,
    name: l.nft.name,
    collection: l.nft.collection.name,
    imageSeed: l.nft.imageSeed,
    price: Number(l.price),
    seller: l.seller.displayUsername ?? l.seller.username,
    mine: l.seller.id === session.user.id,
  }));

  const ownedVMs: OwnedVM[] = owned.map((n) => ({
    nftId: n.id,
    name: n.name,
    collection: n.collection.name,
    imageSeed: n.imageSeed,
    listedPrice: n.listings[0] ? Number(n.listings[0].price) : null,
    listingId: n.listings[0]?.id ?? null,
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl animate-fade-rise flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">NFT Marketplace</h1>
        <p className="text-sm text-foreground-muted">
          Buy and sell unique on-chain art, settled instantly in USDT.
        </p>
      </div>
      <NftClient listings={listingVMs} owned={ownedVMs} available={available} />
    </div>
  );
}
