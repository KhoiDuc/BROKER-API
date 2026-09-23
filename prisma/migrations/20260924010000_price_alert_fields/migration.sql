ALTER TABLE "PriceAlert" ADD COLUMN "assetType" TEXT NOT NULL DEFAULT 'stock';
ALTER TABLE "PriceAlert" ADD COLUMN "triggeredAt" TIMESTAMP(3);
ALTER TABLE "PriceAlert" ADD COLUMN "triggeredPrice" DECIMAL(18,4);
