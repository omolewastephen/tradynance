-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN     "confirmationCodeHash" TEXT,
ADD COLUMN     "confirmationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedReason" TEXT,
ALTER COLUMN "status" SET DEFAULT 'AWAITING_CONFIRMATION';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "withdrawalWhitelistOnly" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "WithdrawalWhitelist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "memo" TEXT,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalWhitelist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WithdrawalWhitelist_userId_idx" ON "WithdrawalWhitelist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalWhitelist_userId_network_address_key" ON "WithdrawalWhitelist"("userId", "network", "address");

-- AddForeignKey
ALTER TABLE "WithdrawalWhitelist" ADD CONSTRAINT "WithdrawalWhitelist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
