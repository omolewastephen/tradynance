-- CreateEnum
CREATE TYPE "StakeStatus" AS ENUM ('ACTIVE', 'REDEEMED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerEntryType" ADD VALUE 'STAKE';
ALTER TYPE "LedgerEntryType" ADD VALUE 'STAKING_REWARD';

-- CreateTable
CREATE TABLE "StakingProduct" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aprBps" INTEGER NOT NULL,
    "lockDays" INTEGER NOT NULL,
    "minStake" DECIMAL(36,18) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StakingProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StakePosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "principal" DECIMAL(36,18) NOT NULL,
    "aprBps" INTEGER NOT NULL,
    "lockDays" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlockAt" TIMESTAMP(3),
    "status" "StakeStatus" NOT NULL DEFAULT 'ACTIVE',
    "rewardPaid" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "redeemedAt" TIMESTAMP(3),

    CONSTRAINT "StakePosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StakePosition_userId_status_idx" ON "StakePosition"("userId", "status");

-- AddForeignKey
ALTER TABLE "StakingProduct" ADD CONSTRAINT "StakingProduct_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StakePosition" ADD CONSTRAINT "StakePosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StakePosition" ADD CONSTRAINT "StakePosition_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StakingProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StakePosition" ADD CONSTRAINT "StakePosition_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
