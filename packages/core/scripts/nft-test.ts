// Correctness test for the NFT marketplace: list (ownership-guarded), buy (buyer debited, seller
// credited net of fee, ownership transferred, listing SOLD, both notified), and the guards
// (can't buy your own, insufficient funds, buy inactive, non-owner list, cancel). Verifies the
// two-party payment conserves (buyer − price, seller + price·(1−fee), fee to platform). Cleans up.
import { prisma, listNft, buyNft, cancelListing, getSpotWallet, NFT_FEE_BPS } from "../src/index.js";
import { Prisma } from "../generated/prisma/index.js";

const D = (n: string | number) => new Prisma.Decimal(n);
let ok = true;
const check = (n: string, p: boolean, e = "") => { console.log(p ? "PASS" : "FAIL", "-", n, e); if (!p) ok = false; };

const stamp = Date.now();
const sellerEmail = `nft-s-${stamp}@t.local`;
const buyerEmail = `nft-b-${stamp}@t.local`;
const symbol = `TST${stamp % 100000}`;

async function mkUser(email: string) {
  return prisma.user.create({ data: { email, username: email.split("@")[0], referralCode: Math.random().toString(36).slice(2, 12).toUpperCase(), emailVerified: true } });
}
async function usdtBal(userId: string, usdtId: string) {
  const w = await prisma.wallet.findFirst({ where: { userId, assetId: usdtId, network: "SPOT" } });
  return w ? D(w.balance) : D(0);
}

async function main() {
  const seller = await mkUser(sellerEmail);
  const buyer = await mkUser(buyerEmail);
  const usdt = await prisma.asset.findUniqueOrThrow({ where: { symbol: "USDT" } });
  const bw = await getSpotWallet(prisma as never, buyer.id, usdt.id);
  await prisma.wallet.update({ where: { id: bw.id }, data: { balance: "1000" } });

  const collection = await prisma.nftCollection.create({ data: { name: `Test ${stamp}`, symbol, description: "t" } });
  const nft = await prisma.nft.create({ data: { collectionId: collection.id, tokenId: 1, name: "Test #1", imageSeed: "seed1", ownerId: seller.id } });

  // non-owner can't list
  check("non-owner can't list", !(await listNft(prisma as never, { userId: buyer.id, nftId: nft.id, price: "100" })).ok);

  // seller lists at 100
  const listed = await listNft(prisma as never, { userId: seller.id, nftId: nft.id, price: "100" });
  check("list ok", listed.ok, listed.ok ? "" : (listed as { error: string }).error);
  if (!listed.ok) return;

  // can't double-list
  check("double-list rejected", !(await listNft(prisma as never, { userId: seller.id, nftId: nft.id, price: "120" })).ok);

  // seller can't buy own
  check("can't buy own NFT", !(await buyNft(prisma as never, { userId: seller.id, listingId: listed.listingId })).ok);

  const sellerBefore = await usdtBal(seller.id, usdt.id);
  const buyerBefore = await usdtBal(buyer.id, usdt.id);

  // buyer buys
  const bought = await buyNft(prisma as never, { userId: buyer.id, listingId: listed.listingId });
  check("buy ok", bought.ok, bought.ok ? "" : (bought as { error: string }).error);
  if (!bought.ok) return;

  const fee = D("100").times(NFT_FEE_BPS).dividedBy(10000);
  const sellerGets = D("100").minus(fee);
  check("fee = 2% of price", D(bought.fee).equals(fee), `fee=${bought.fee}`);
  check("seller received price − fee", D(bought.sellerReceived).equals(sellerGets));

  const buyerAfter = await usdtBal(buyer.id, usdt.id);
  const sellerAfter = await usdtBal(seller.id, usdt.id);
  check("buyer debited full price", buyerBefore.minus(buyerAfter).equals("100"), `Δ=${buyerBefore.minus(buyerAfter)}`);
  check("seller credited net of fee", sellerAfter.minus(sellerBefore).equals(sellerGets), `Δ=${sellerAfter.minus(sellerBefore)}`);
  check("two-party conservation (fee left to platform)",
    buyerAfter.minus(buyerBefore).plus(sellerAfter.minus(sellerBefore)).equals(fee.negated()));

  // ownership transferred
  const owned = await prisma.nft.findUniqueOrThrow({ where: { id: nft.id } });
  check("ownership transferred to buyer", owned.ownerId === buyer.id);
  const listingRow = await prisma.nftListing.findUniqueOrThrow({ where: { id: listed.listingId } });
  check("listing marked SOLD", listingRow.status === "SOLD" && listingRow.buyerId === buyer.id);

  // both notified
  check("seller + buyer notified", (await prisma.notification.count({ where: { userId: { in: [seller.id, buyer.id] } } })) >= 2);

  // can't buy a sold listing
  check("buying sold listing rejected", !(await buyNft(prisma as never, { userId: seller.id, listingId: listed.listingId })).ok);

  // NFT ledger entries: one debit (buyer) + one credit (seller)
  check("two NFT ledger entries", (await prisma.ledgerEntry.count({ where: { type: "NFT", referenceId: listed.listingId } })) === 2);

  // new owner (buyer) can relist; then cancel
  const relist = await listNft(prisma as never, { userId: buyer.id, nftId: nft.id, price: "150" });
  check("new owner can relist", relist.ok);
  if (relist.ok) {
    check("non-seller can't cancel", !(await cancelListing(prisma as never, { userId: seller.id, listingId: relist.listingId })).ok);
    check("seller cancels own listing", (await cancelListing(prisma as never, { userId: buyer.id, listingId: relist.listingId })).ok);
  }

  // insufficient funds: broke user can't buy
  const broke = await mkUser(`nft-p-${stamp}@t.local`);
  const relist2 = await listNft(prisma as never, { userId: buyer.id, nftId: nft.id, price: "150" });
  if (relist2.ok) {
    check("insufficient funds rejected", !(await buyNft(prisma as never, { userId: broke.id, listingId: relist2.listingId })).ok);
  }
  await prisma.nftListing.deleteMany({ where: { sellerId: broke.id } });
  await prisma.ledgerEntry.deleteMany({ where: { userId: broke.id } });
  await prisma.wallet.deleteMany({ where: { userId: broke.id } });
  await prisma.user.delete({ where: { id: broke.id } });
}

main().catch((e) => { console.error(e); ok = false; }).finally(async () => {
  for (const email of [buyerEmail, sellerEmail]) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) {
      await prisma.notification.deleteMany({ where: { userId: u.id } });
      await prisma.nftListing.deleteMany({ where: { OR: [{ sellerId: u.id }, { buyerId: u.id }] } });
      await prisma.nft.deleteMany({ where: { ownerId: u.id } });
      await prisma.ledgerEntry.deleteMany({ where: { userId: u.id } });
      await prisma.wallet.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  }
  await prisma.nftCollection.deleteMany({ where: { symbol } });
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
});
