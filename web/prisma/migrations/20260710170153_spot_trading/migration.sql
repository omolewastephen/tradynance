-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "avgFillPrice" DECIMAL(36,18),
ADD COLUMN     "cumulativeQuote" DECIMAL(36,18) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "takerSide" "OrderSide" NOT NULL;

-- CreateIndex
CREATE INDEX "Order_marketId_side_status_price_idx" ON "Order"("marketId", "side", "status", "price");

