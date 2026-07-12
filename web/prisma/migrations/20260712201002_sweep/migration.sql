-- CreateTable
CREATE TABLE "Sweep" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "userId" TEXT,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "txHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sweep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sweep_txHash_key" ON "Sweep"("txHash");

-- CreateIndex
CREATE INDEX "Sweep_createdAt_idx" ON "Sweep"("createdAt");
