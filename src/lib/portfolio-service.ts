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
  const symbols = positions.map((position) => position.symbol);
  console.log(`[portfolio-service] Saving ${positions.length} positions in single transaction…`);

  try {
    // Single transaction — all upserts + deletes in one DB round-trip batch
    await prisma.$transaction(async (tx) => {
      for (const position of positions) {
        await upsertPositionWithClient(tx, position);
      }

      // Delete positions not in the incoming payload
      if (symbols.length > 0) {
        await tx.position.deleteMany({
          where: { symbol: { notIn: symbols } },
        });
      } else {
        await tx.position.deleteMany({});
      }
    });

    console.log(`[portfolio-service] Transaction OK — ${positions.length} positions saved`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[portfolio-service] Transaction FAIL:", msg);
    throw new Error(`Save failed: ${msg}`);
  }

  return getPortfolio();
}

type DbClient = typeof prisma;

async function upsertPositionWithClient(tx: DbClient, position: PositionUpsertInput) {
  const buyIds = position.buys.map((lot) => lot.id);
  const sellIds = position.sells.map((sell) => sell.id);
  const noteIds = position.notes.map((note) => note.id);
  const dividendIds = position.dividends.map((dividend) => dividend.id);

  const saved = await tx.position.upsert({
    where: { symbol: position.symbol },
    create: {
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
    update: {
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
    },
  });

  await Promise.all([
    ...position.buys.map((lot) =>
      tx.buyLot.upsert({
        where: { id: lot.id },
        create: { ...lot, positionId: saved.id },
        update: {
          boughtAt: lot.boughtAt,
          price: lot.price,
          quantity: lot.quantity,
          stopLoss: lot.stopLoss,
          stopLossMode: lot.stopLossMode,
          stopLossInput: lot.stopLossInput,
          targetPrice: lot.targetPrice,
          targetPriceMode: lot.targetPriceMode,
          targetPriceInput: lot.targetPriceInput,
          note: lot.note,
          tags: lot.tags,
        },
      }),
    ),
    ...position.sells.map((sell) =>
      tx.sell.upsert({
        where: { id: sell.id },
        create: { ...sell, positionId: saved.id },
        update: {
          soldAt: sell.soldAt,
          price: sell.price,
          quantity: sell.quantity,
          fee: sell.fee,
          tax: sell.tax,
          note: sell.note,
        },
      }),
    ),
    ...position.notes.map((note) =>
      tx.note.upsert({
        where: { id: note.id },
        create: { ...note, positionId: saved.id },
        update: {
          at: note.at,
          kind: note.kind,
          text: note.text,
          aiExplain: note.aiExplain,
        },
      }),
    ),
    ...position.dividends.map((dividend) =>
      tx.dividend.upsert({
        where: { id: dividend.id },
        create: { ...dividend, positionId: saved.id },
        update: {
          exDate: dividend.exDate,
          payDate: dividend.payDate,
          amountPerShare: dividend.amountPerShare,
          quantity: dividend.quantity,
          note: dividend.note,
        },
      }),
    ),
  ]);

  await Promise.all([
    tx.buyLot.deleteMany({
      where: { positionId: saved.id, id: { notIn: buyIds.length ? buyIds : ["__none__"] } },
    }),
    tx.sell.deleteMany({
      where: { positionId: saved.id, id: { notIn: sellIds.length ? sellIds : ["__none__"] } },
    }),
    tx.note.deleteMany({
      where: { positionId: saved.id, id: { notIn: noteIds.length ? noteIds : ["__none__"] } },
    }),
    tx.dividend.deleteMany({
      where: {
        positionId: saved.id,
        id: { notIn: dividendIds.length ? dividendIds : ["__none__"] },
      },
    }),
  ]);
}