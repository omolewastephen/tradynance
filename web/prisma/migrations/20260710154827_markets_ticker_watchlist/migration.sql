-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "dataSourceSymbol" TEXT;

-- CreateTable
CREATE TABLE "Ticker" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "lastPrice" DECIMAL(36,18) NOT NULL,
    "priceChangePercent" DECIMAL(18,4) NOT NULL,
    "high24h" DECIMAL(36,18) NOT NULL,
    "low24h" DECIMAL(36,18) NOT NULL,
    "volume" DECIMAL(36,8) NOT NULL,
    "quoteVolume" DECIMAL(36,8) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticker_marketId_key" ON "Ticker"("marketId");

-- CreateIndex
CREATE INDEX "Watchlist_userId_idx" ON "Watchlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_userId_marketId_key" ON "Watchlist"("userId", "marketId");

-- AddForeignKey
ALTER TABLE "Ticker" ADD CONSTRAINT "Ticker_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

