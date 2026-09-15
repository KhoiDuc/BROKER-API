import { prisma } from "./prisma";
import { fromBrokerPortfolio, toBrokerPortfolio, type PositionUpsertInput } from "./mapper";
import type { BrokerPortfolioJson } from "./types";

const positionInclude = {
  buys: true,
  sells: true,
  notes: true,
  dividends: true,
} as const;

export async function getPortfolio() {
  const rows = await prisma.position.findMany({
    include: positionInclude,
    orderBy: { symbol: "asc" },
  });
  return toBrokerPortfolio(rows);
}

export async function savePortfolio(portfolio: BrokerPortfolioJson) {
  const positions = fromBrokerPortfolio(portfolio);
  console.log(`[portfolio-service] Save ${positions.length} positions — delete-all + create…`);

  try {
    // Delete all + recreate — 2 DB round-trips instead of ~108 upserts
    await prisma.$transaction([
      prisma.buyLot.deleteMany({}),
      prisma.sell.deleteMany({}),
      prisma.note.deleteMany({}),
      prisma.dividend.deleteMany({}),
      prisma.position.deleteMany({}),
    ]);

    // Create all positions with nested children in parallel
    await Promise.all(
      positions.map((position) =>
        prisma.position.create({
          data: {
            symbol: position.symbol,
            sector: position.sector,
            status: position.status,
            stopLoss: position.stopLoss,
            stopLossMode: position.stopLossMode,
            stopLossInput: position.stopLossInput,
            targetPrice: position.targetPrice,
            targetPriceMode: position.targetPriceMode,
            targetPriceInput: position.targetPriceInput,
            weightPct: position.weightPct,
            entryLow: position.entryLow,
            entryHigh: position.entryHigh,
            recommendationText: position.recommendationText,
            tags: position.tags,
            isArchived: position.isArchived,
            buys: { create: position.buys },
            sells: { create: position.sells },
            notes: { create: position.notes },
            dividends: { create: position.dividends },
          },
        }),
      ),
    );

    console.log(`[portfolio-service] OK — ${positions.length} positions created`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[portfolio-service] FAIL:", msg);
    throw new Error(`Save failed: ${msg}`);
  }

  return getPortfolio();
}