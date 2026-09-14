-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('ChuaQuyet', 'ChoMua', 'NamGiu', 'CatLo', 'ChotLoi', 'BoTheoDoi');

-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('Broker', 'Self');

-- CreateEnum
CREATE TYPE "LevelInputMode" AS ENUM ('Price', 'Percent');

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "sector" TEXT NOT NULL DEFAULT '',
    "status" "PositionStatus" NOT NULL DEFAULT 'ChuaQuyet',
    "stopLoss" DECIMAL(18,4),
    "stopLossMode" "LevelInputMode",
    "stopLossInput" DECIMAL(18,4),
    "targetPrice" DECIMAL(18,4),
    "targetPriceMode" "LevelInputMode",
    "targetPriceInput" DECIMAL(18,4),
    "weightPct" DECIMAL(18,4),
    "entryLow" DECIMAL(18,4),
    "entryHigh" DECIMAL(18,4),
    "recommendationText" TEXT,
    "tags" TEXT[],
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyLot" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "boughtAt" DATE NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "quantity" DECIMAL(18,4),
    "stopLoss" DECIMAL(18,4),
    "stopLossMode" "LevelInputMode",
    "stopLossInput" DECIMAL(18,4),
    "targetPrice" DECIMAL(18,4),
    "targetPriceMode" "LevelInputMode",
    "targetPriceInput" DECIMAL(18,4),
    "note" TEXT,
    "tags" TEXT[],

    CONSTRAINT "BuyLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sell" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "soldAt" DATE NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "quantity" DECIMAL(18,4),
    "fee" DECIMAL(18,4),
    "tax" DECIMAL(18,4),
    "note" TEXT,

    CONSTRAINT "Sell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "kind" "NoteKind" NOT NULL DEFAULT 'Broker',
    "text" TEXT NOT NULL,
    "aiExplain" TEXT,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dividend" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "exDate" DATE NOT NULL,
    "payDate" DATE,
    "amountPerShare" DECIMAL(18,4) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "Dividend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Position_symbol_key" ON "Position"("symbol");

-- AddForeignKey
ALTER TABLE "BuyLot" ADD CONSTRAINT "BuyLot_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sell" ADD CONSTRAINT "Sell_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

