// NFT marketplace. NFTs are unique — ownership is `Nft.ownerId`, not a wallet balance — so only
// the USDT payment flows through the ledger. Buying, in ONE transaction: debits the buyer, credits
// the seller (minus a marketplace fee), transfers ownership, and closes the listing. The fee is
// platform revenue (an unmodeled sink, like trade fees). List/cancel are ownership-guarded and
// touch no money.

import { Prisma, type PrismaClient } from "../generated/prisma/index.js";
import { getSpotWallet } from "./trading-engine.js";
import { notify } from "./notifications.js";

const D = Prisma.Decimal;

export const NFT_FEE_BPS = Number(process.env.NFT_FEE_BPS ?? 200); // 2% marketplace fee
const QUOTE_SYMBOL = "USDT";

export type ListResult = { ok: true; listingId: string } | { ok: false; error: string };

/** List an owned NFT for sale at `price` USDT. Rejects if already actively listed. */
export async function listNft(
  prisma: PrismaClient,
  input: { userId: string; nftId: string; price: string | number },
): Promise<ListResult> {
  const price = new D(input.price);
  if (price.lessThanOrEqualTo(0)) return { ok: false, error: "Price must be positive" };
  try {
    return await prisma.$transaction(async (tx) => {
      const nft = await tx.nft.findUnique({ where: { id: input.nftId } });
      if (!nft) return { ok: false as const, error: "NFT not found" };
      if (nft.ownerId !== input.userId) return { ok: false as const, error: "You don't own this NFT" };

      const active = await tx.nftListing.findFirst({
        where: { nftId: nft.id, status: "ACTIVE" },
      });
      if (active) return { ok: false as const, error: "Already listed" };

      const listing = await tx.nftListing.create({
        data: { nftId: nft.id, sellerId: input.userId, price },
      });
      return { ok: true as const, listingId: listing.id };
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type CancelResult = { ok: true } | { ok: false; error: string };

export async function cancelListing(
  prisma: PrismaClient,
  input: { userId: string; listingId: string },
): Promise<CancelResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const listing = await tx.nftListing.findUnique({ where: { id: input.listingId } });
      if (!listing) return { ok: false as const, error: "Listing not found" };
      if (listing.sellerId !== input.userId) return { ok: false as const, error: "Not your listing" };
      if (listing.status !== "ACTIVE") return { ok: false as const, error: "Listing is not active" };
      await tx.nftListing.update({ where: { id: listing.id }, data: { status: "CANCELLED" } });
      return { ok: true as const };
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type BuyResult =
  | { ok: true; price: string; sellerReceived: string; fee: string }
  | { ok: false; error: string };

/** Buy a listed NFT: pay the seller (minus fee), take ownership, close the listing — atomically. */
export async function buyNft(
  prisma: PrismaClient,
  input: { userId: string; listingId: string },
): Promise<BuyResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const listing = await tx.nftListing.findUnique({
        where: { id: input.listingId },
        include: { nft: { select: { id: true, name: true, ownerId: true } } },
      });
      if (!listing) return { ok: false as const, error: "Listing not found" };
      if (listing.status !== "ACTIVE") return { ok: false as const, error: "Listing is no longer active" };
      if (listing.sellerId === input.userId) return { ok: false as const, error: "You can't buy your own NFT" };
      // Guard against a stale listing whose NFT has since changed hands.
      if (listing.nft.ownerId !== listing.sellerId) {
        return { ok: false as const, error: "Listing is stale" };
      }

      const usdt = await tx.asset.findUnique({ where: { symbol: QUOTE_SYMBOL } });
      if (!usdt) return { ok: false as const, error: "Quote asset missing" };

      const price = new D(listing.price);
      const fee = price.times(NFT_FEE_BPS).dividedBy(10_000);
      const sellerGets = price.minus(fee);

      // Debit buyer.
      const buyerWallet = await getSpotWallet(tx, input.userId, usdt.id);
      const buyerAvail = new D(buyerWallet.balance).minus(buyerWallet.lockedBalance);
      if (buyerAvail.lessThan(price)) return { ok: false as const, error: "Insufficient USDT balance" };
      const buyerNew = new D(buyerWallet.balance).minus(price);
      await tx.ledgerEntry.create({
        data: {
          walletId: buyerWallet.id, userId: input.userId, assetId: usdt.id,
          type: "NFT", status: "CONFIRMED", amount: price.negated(), balanceAfter: buyerNew,
          referenceType: "NftListing", referenceId: listing.id, note: `buy ${listing.nft.name}`,
        },
      });
      await tx.wallet.update({ where: { id: buyerWallet.id }, data: { balance: buyerNew } });

      // Credit seller (net of fee).
      const sellerWallet = await getSpotWallet(tx, listing.sellerId, usdt.id);
      const sellerNew = new D(sellerWallet.balance).plus(sellerGets);
      await tx.ledgerEntry.create({
        data: {
          walletId: sellerWallet.id, userId: listing.sellerId, assetId: usdt.id,
          type: "NFT", status: "CONFIRMED", amount: sellerGets, balanceAfter: sellerNew,
          referenceType: "NftListing", referenceId: listing.id, note: `sold ${listing.nft.name}`,
        },
      });
      await tx.wallet.update({ where: { id: sellerWallet.id }, data: { balance: sellerNew } });

      // Transfer ownership + close the listing.
      await tx.nft.update({ where: { id: listing.nft.id }, data: { ownerId: input.userId } });
      await tx.nftListing.update({
        where: { id: listing.id },
        data: { status: "SOLD", buyerId: input.userId, soldAt: new Date() },
      });

      await notify(tx, {
        userId: listing.sellerId, type: "SYSTEM", title: "NFT sold",
        body: `Your NFT "${listing.nft.name}" sold for ${price.toString()} ${QUOTE_SYMBOL} (you received ${sellerGets.toString()}).`,
        referenceType: "NftListing", referenceId: listing.id,
      });
      await notify(tx, {
        userId: input.userId, type: "SYSTEM", title: "NFT purchased",
        body: `You bought "${listing.nft.name}" for ${price.toString()} ${QUOTE_SYMBOL}.`,
        referenceType: "NftListing", referenceId: listing.id,
      });

      return { ok: true as const, price: price.toString(), sellerReceived: sellerGets.toString(), fee: fee.toString() };
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
