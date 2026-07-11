-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'REFERRAL_COMMISSION';

-- CreateTable
CREATE TABLE "ReferralCommission" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "feeAmount" DECIMAL(36,18) NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "commissionAmount" DECIMAL(36,18) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCommission_ledgerEntryId_key" ON "ReferralCommission"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "ReferralCommission_referrerId_createdAt_idx" ON "ReferralCommission"("referrerId", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralCommission_refereeId_idx" ON "ReferralCommission"("refereeId");

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
