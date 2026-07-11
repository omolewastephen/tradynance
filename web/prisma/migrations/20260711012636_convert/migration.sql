-- CreateTable
CREATE TABLE "Conversion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromAssetId" TEXT NOT NULL,
    "toAssetId" TEXT NOT NULL,
    "fromAmount" DECIMAL(36,18) NOT NULL,
    "toAmount" DECIMAL(36,18) NOT NULL,
    "rate" DECIMAL(36,18) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversion_userId_createdAt_idx" ON "Conversion"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_fromAssetId_fkey" FOREIGN KEY ("fromAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversion" ADD CONSTRAINT "Conversion_toAssetId_fkey" FOREIGN KEY ("toAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

