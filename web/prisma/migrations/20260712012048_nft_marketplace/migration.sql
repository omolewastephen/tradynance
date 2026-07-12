-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED');

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'NFT';

-- CreateTable
CREATE TABLE "NftCollection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NftCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nft" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "imageSeed" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NftListing" (
    "id" TEXT NOT NULL,
    "nftId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT,
    "price" DECIMAL(36,18) NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" TIMESTAMP(3),

    CONSTRAINT "NftListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NftCollection_symbol_key" ON "NftCollection"("symbol");

-- CreateIndex
CREATE INDEX "Nft_ownerId_idx" ON "Nft"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Nft_collectionId_tokenId_key" ON "Nft"("collectionId", "tokenId");

-- CreateIndex
CREATE INDEX "NftListing_status_createdAt_idx" ON "NftListing"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Nft" ADD CONSTRAINT "Nft_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "NftCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nft" ADD CONSTRAINT "Nft_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftListing" ADD CONSTRAINT "NftListing_nftId_fkey" FOREIGN KEY ("nftId") REFERENCES "Nft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftListing" ADD CONSTRAINT "NftListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftListing" ADD CONSTRAINT "NftListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
