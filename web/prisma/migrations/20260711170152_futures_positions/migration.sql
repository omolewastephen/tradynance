-- CreateEnum
CREATE TYPE "PositionSide" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'CLOSED', 'LIQUIDATED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerEntryType" ADD VALUE 'FUTURES_MARGIN';
ALTER TYPE "LedgerEntryType" ADD VALUE 'FUTURES_PNL';
ALTER TYPE "LedgerEntryType" ADD VALUE 'FUNDING';
ALTER TYPE "LedgerEntryType" ADD VALUE 'LIQUIDATION';

-- CreateTable
CREATE TABLE "FuturesPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "side" "PositionSide" NOT NULL,
    "leverage" INTEGER NOT NULL,
    "size" DECIMAL(36,18) NOT NULL,
    "entryPrice" DECIMAL(36,18) NOT NULL,
    "margin" DECIMAL(36,18) NOT NULL,
    "liquidationPrice" DECIMAL(36,18) NOT NULL,
    "fundingAccrued" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "realizedPnl" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "closePrice" DECIMAL(36,18),
    "status" "PositionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "FuturesPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FuturesPosition_userId_status_idx" ON "FuturesPosition"("userId", "status");

-- CreateIndex
CREATE INDEX "FuturesPosition_marketId_status_idx" ON "FuturesPosition"("marketId", "status");

-- AddForeignKey
ALTER TABLE "FuturesPosition" ADD CONSTRAINT "FuturesPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuturesPosition" ADD CONSTRAINT "FuturesPosition_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
