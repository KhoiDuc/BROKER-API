-- CreateTable
CREATE TABLE "WsTicket" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "stream" TEXT NOT NULL,
    "symbol" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WsTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "OrderIdempotency" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "pending" BOOLEAN NOT NULL DEFAULT true,
    "body" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nav" DECIMAL(18,4) NOT NULL,
    "realizedPnl" DECIMAL(18,4) NOT NULL,
    "unrealizedPnl" DECIMAL(18,4),
    "dividendIncome" DECIMAL(18,4) NOT NULL,
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'discord',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastFiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WsTicket_expiresAt_idx" ON "WsTicket"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderIdempotency_username_key_key" ON "OrderIdempotency"("username", "key");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_takenAt_idx" ON "PortfolioSnapshot"("takenAt");

-- CreateIndex
CREATE INDEX "PriceAlert_symbol_idx" ON "PriceAlert"("symbol");
