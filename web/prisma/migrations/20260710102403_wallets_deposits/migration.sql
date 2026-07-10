-- CreateEnum
CREATE TYPE "DepositSource" AS ENUM ('CHAIN', 'MANUAL');

-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "source" "DepositSource" NOT NULL DEFAULT 'CHAIN',
ADD COLUMN     "txOutputIndex" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "derivationIndex" INTEGER;

-- CreateTable
CREATE TABLE "DerivationCounter" (
    "network" TEXT NOT NULL,
    "nextIndex" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DerivationCounter_pkey" PRIMARY KEY ("network")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_network_txHash_txOutputIndex_key" ON "Deposit"("network", "txHash", "txOutputIndex");

