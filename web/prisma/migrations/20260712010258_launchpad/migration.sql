-- CreateEnum
CREATE TYPE "LaunchpadStatus" AS ENUM ('UPCOMING', 'LIVE', 'ENDED', 'DISTRIBUTED');

-- AlterEnum
ALTER TYPE "LedgerEntryType" ADD VALUE 'LAUNCHPAD';

-- CreateTable
CREATE TABLE "LaunchpadProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenAssetId" TEXT NOT NULL,
    "saleAssetId" TEXT NOT NULL,
    "tokenPrice" DECIMAL(36,18) NOT NULL,
    "totalAllocation" DECIMAL(36,18) NOT NULL,
    "soldAllocation" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "minCommit" DECIMAL(36,18) NOT NULL,
    "maxCommit" DECIMAL(36,18) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "LaunchpadStatus" NOT NULL DEFAULT 'UPCOMING',
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaunchpadProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchpadCommitment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "committedAmount" DECIMAL(36,18) NOT NULL,
    "tokenAmount" DECIMAL(36,18) NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaunchpadCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LaunchpadCommitment_userId_projectId_key" ON "LaunchpadCommitment"("userId", "projectId");

-- AddForeignKey
ALTER TABLE "LaunchpadProject" ADD CONSTRAINT "LaunchpadProject_tokenAssetId_fkey" FOREIGN KEY ("tokenAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchpadProject" ADD CONSTRAINT "LaunchpadProject_saleAssetId_fkey" FOREIGN KEY ("saleAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchpadCommitment" ADD CONSTRAINT "LaunchpadCommitment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchpadCommitment" ADD CONSTRAINT "LaunchpadCommitment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LaunchpadProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
