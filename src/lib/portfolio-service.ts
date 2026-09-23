import { prisma } from "./prisma";
import { ensureId, fromBrokerPortfolio, mapDividend, mapLot, mapNote, mapPosition, mapSell, normalizeSymbol, parseDate, toBrokerPortfolio, toPositionUpsert } from "./mapper";
import type { BrokerPortfolioJson, BrokerPositionJson, BrokerLotJson, BrokerSellJson, BrokerNoteJson, BrokerDividendJson } from "./types";
import type { PositionStatus, NoteKind, LevelInputMode, BuyLot, Sell, Note, Dividend, Position } from "@prisma/client";

const positionInclude = {
  buys: true,
  sells: true,
  notes: true,
  dividends: true,
} as const;

// ── Portfolio-level ──

export async function getPortfolio() {
  const rows = await prisma.position.findMany({
    include: positionInclude,
    orderBy: { symbol: "asc" },
  });
  return toBrokerPortfolio(rows);
}

export async function getPosition(symbol: string) {
  const sym = normalizeSymbol(symbol);
  const row = await prisma.position.findUnique({
    where: { symbol: sym },
    include: positionInclude,
  });
  if (!row) return null;
  return mapPosition(row);
}

export async function savePortfolio(portfolio: BrokerPortfolioJson) {
  const positions = fromBrokerPortfolio(portfolio);
  console.log(JSON.stringify({ level: "info", msg: "portfolio-import-start", count: positions.length }));

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.buyLot.deleteMany();
        await tx.sell.deleteMany();
        await tx.note.deleteMany();
        await tx.dividend.deleteMany();
        await tx.position.deleteMany();

        for (const position of positions) {
          await tx.position.create({
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
          });
        }
      },
      { timeout: 30_000, maxWait: 10_000 },
    );

    console.log(JSON.stringify({ level: "info", msg: "portfolio-import-ok", count: positions.length }));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ level: "error", msg: "portfolio-import-fail", error: msg }));
    throw new Error(`Import failed: ${msg}`);
  }

  return getPortfolio();
}

// ── Position CRUD ──

function positionCreateData(input: ReturnType<typeof toPositionUpsert>) {
  return {
    symbol: input.symbol,
    sector: input.sector,
    status: input.status,
    stopLoss: input.stopLoss,
    stopLossMode: input.stopLossMode,
    stopLossInput: input.stopLossInput,
    targetPrice: input.targetPrice,
    targetPriceMode: input.targetPriceMode,
    targetPriceInput: input.targetPriceInput,
    weightPct: input.weightPct,
    entryLow: input.entryLow,
    entryHigh: input.entryHigh,
    recommendationText: input.recommendationText,
    tags: input.tags,
    isArchived: input.isArchived,
    buys: { create: input.buys },
    sells: { create: input.sells },
    notes: { create: input.notes },
    dividends: { create: input.dividends },
  };
}

export async function createPosition(data: BrokerPositionJson) {
  const input = toPositionUpsert(data, data.status === "DaDong");
  const created = await prisma.position.create({
    data: positionCreateData(input),
    include: positionInclude,
  });
  return mapPosition(created);
}

export async function updatePositionFull(symbol: string, data: BrokerPositionJson) {
  const sym = normalizeSymbol(symbol);
  const position = await prisma.position.findUnique({ where: { symbol: sym } });
  if (!position) throw new Error(`Position ${sym} not found`);

  const input = toPositionUpsert({ ...data, symbol: sym }, data.status === "DaDong" ? true : position.isArchived);

  // 1 transaction: update position + delete all children + re-create
  const updated = await prisma.$transaction([
    prisma.buyLot.deleteMany({ where: { positionId: position.id } }),
    prisma.sell.deleteMany({ where: { positionId: position.id } }),
    prisma.note.deleteMany({ where: { positionId: position.id } }),
    prisma.dividend.deleteMany({ where: { positionId: position.id } }),
    prisma.position.update({
      where: { symbol: sym },
      data: {
        sector: input.sector,
        status: input.status,
        stopLoss: input.stopLoss,
        stopLossMode: input.stopLossMode,
        stopLossInput: input.stopLossInput,
        targetPrice: input.targetPrice,
        targetPriceMode: input.targetPriceMode,
        targetPriceInput: input.targetPriceInput,
        weightPct: input.weightPct,
        entryLow: input.entryLow,
        entryHigh: input.entryHigh,
        recommendationText: input.recommendationText,
        tags: input.tags,
        isArchived: input.isArchived,
        buys: { create: input.buys },
        sells: { create: input.sells },
        notes: { create: input.notes },
        dividends: { create: input.dividends },
      },
      include: positionInclude,
    }),
  ]);

  return mapPosition(updated[4] as Position & { buys: BuyLot[]; sells: Sell[]; notes: Note[]; dividends: Dividend[] });
}

export async function deletePosition(symbol: string) {
  const sym = normalizeSymbol(symbol);
  await prisma.position.delete({ where: { symbol: sym } });
}

export async function archivePosition(
  symbol: string,
  isArchived: boolean,
  status?: PositionStatus,
) {
  const sym = normalizeSymbol(symbol);
  const updated = await prisma.position.update({
    where: { symbol: sym },
    data: {
      isArchived,
      ...(status ? { status } : {}),
    },
    include: positionInclude,
  });
  return mapPosition(updated);
}

// ── BuyLot CRUD ──

export async function addLot(symbol: string, data: BrokerLotJson) {
  const sym = normalizeSymbol(symbol);
  const position = await prisma.position.findUnique({ where: { symbol: sym } });
  if (!position) throw new Error(`Position ${sym} not found`);

  const created = await prisma.buyLot.create({
    data: {
      id: ensureId(data.id, `${sym.toLowerCase()}b`),
      positionId: position.id,
      boughtAt: parseDate(data.boughtAt),
      price: data.price,
      quantity: data.quantity ?? null,
      stopLoss: data.stopLoss ?? null,
      stopLossMode: (data.stopLossMode ?? null) as LevelInputMode | null,
      stopLossInput: data.stopLossInput ?? null,
      targetPrice: data.targetPrice ?? null,
      targetPriceMode: (data.targetPriceMode ?? null) as LevelInputMode | null,
      targetPriceInput: data.targetPriceInput ?? null,
      note: data.note?.trim() ?? null,
      tags: data.tags ?? [],
    },
  });
  return mapLot(created);
}

export async function updateLot(symbol: string, lotId: string, data: BrokerLotJson) {
  const position = await requirePosition(symbol);
  const result = await prisma.buyLot.updateMany({
    where: { id: lotId, positionId: position.id },
    data: {
      boughtAt: parseDate(data.boughtAt),
      price: data.price,
      quantity: data.quantity ?? null,
      stopLoss: data.stopLoss ?? null,
      stopLossMode: (data.stopLossMode ?? null) as LevelInputMode | null,
      stopLossInput: data.stopLossInput ?? null,
      targetPrice: data.targetPrice ?? null,
      targetPriceMode: (data.targetPriceMode ?? null) as LevelInputMode | null,
      targetPriceInput: data.targetPriceInput ?? null,
      note: data.note?.trim() ?? null,
      tags: data.tags ?? [],
    },
  });
  if (result.count === 0) throw new Error(`Lot ${lotId} not found`);
  const updated = await prisma.buyLot.findUnique({ where: { id: lotId } });
  if (!updated) throw new Error(`Lot ${lotId} not found`);
  return mapLot(updated);
}

export async function deleteLot(symbol: string, lotId: string) {
  const position = await requirePosition(symbol);
  const result = await prisma.buyLot.deleteMany({ where: { id: lotId, positionId: position.id } });
  if (result.count === 0) throw new Error(`Lot ${lotId} not found`);
}

// ── Sell CRUD ──

export async function addSell(symbol: string, data: BrokerSellJson) {
  const sym = normalizeSymbol(symbol);
  const position = await prisma.position.findUnique({ where: { symbol: sym } });
  if (!position) throw new Error(`Position ${sym} not found`);

  const created = await prisma.sell.create({
    data: {
      id: ensureId(data.id, `${sym.toLowerCase()}s`),
      positionId: position.id,
      soldAt: parseDate(data.soldAt),
      price: data.price,
      quantity: data.quantity ?? null,
      fee: data.fee ?? null,
      tax: data.tax ?? null,
      note: data.note?.trim() ?? null,
    },
  });
  return mapSell(created);
}

export async function updateSell(symbol: string, sellId: string, data: BrokerSellJson) {
  const position = await requirePosition(symbol);
  const result = await prisma.sell.updateMany({
    where: { id: sellId, positionId: position.id },
    data: {
      soldAt: parseDate(data.soldAt),
      price: data.price,
      quantity: data.quantity ?? null,
      fee: data.fee ?? null,
      tax: data.tax ?? null,
      note: data.note?.trim() ?? null,
    },
  });
  if (result.count === 0) throw new Error(`Sell ${sellId} not found`);
  const updated = await prisma.sell.findUnique({ where: { id: sellId } });
  if (!updated) throw new Error(`Sell ${sellId} not found`);
  return mapSell(updated);
}

export async function deleteSell(symbol: string, sellId: string) {
  const position = await requirePosition(symbol);
  const result = await prisma.sell.deleteMany({ where: { id: sellId, positionId: position.id } });
  if (result.count === 0) throw new Error(`Sell ${sellId} not found`);
}

// ── Note CRUD ──

export async function addNote(symbol: string, data: BrokerNoteJson) {
  const sym = normalizeSymbol(symbol);
  const position = await prisma.position.findUnique({ where: { symbol: sym } });
  if (!position) throw new Error(`Position ${sym} not found`);

  const created = await prisma.note.create({
    data: {
      id: ensureId(data.id, `${sym.toLowerCase()}n`),
      positionId: position.id,
      at: parseDate(data.at),
      kind: (data.kind ?? "Broker") as NoteKind,
      text: data.text?.trim() ?? "",
      aiExplain: data.aiExplain?.trim() ?? null,
    },
  });
  return mapNote(created);
}

export async function updateNote(symbol: string, noteId: string, data: BrokerNoteJson) {
  const position = await requirePosition(symbol);
  const result = await prisma.note.updateMany({
    where: { id: noteId, positionId: position.id },
    data: {
      at: parseDate(data.at),
      kind: (data.kind ?? "Broker") as NoteKind,
      text: data.text?.trim() ?? "",
      aiExplain: data.aiExplain?.trim() ?? null,
    },
  });
  if (result.count === 0) throw new Error(`Note ${noteId} not found`);
  const updated = await prisma.note.findUnique({ where: { id: noteId } });
  if (!updated) throw new Error(`Note ${noteId} not found`);
  return mapNote(updated);
}

export async function deleteNote(symbol: string, noteId: string) {
  const position = await requirePosition(symbol);
  const result = await prisma.note.deleteMany({ where: { id: noteId, positionId: position.id } });
  if (result.count === 0) throw new Error(`Note ${noteId} not found`);
}

// ── Dividend CRUD ──

export async function addDividend(symbol: string, data: BrokerDividendJson) {
  const sym = normalizeSymbol(symbol);
  const position = await prisma.position.findUnique({ where: { symbol: sym } });
  if (!position) throw new Error(`Position ${sym} not found`);

  const created = await prisma.dividend.create({
    data: {
      id: ensureId(data.id, `${sym.toLowerCase()}d`),
      positionId: position.id,
      exDate: parseDate(data.exDate),
      payDate: data.payDate ? parseDate(data.payDate) : null,
      amountPerShare: data.amountPerShare,
      quantity: data.quantity,
      note: data.note?.trim() ?? null,
    },
  });
  return mapDividend(created);
}

export async function updateDividend(symbol: string, dividendId: string, data: BrokerDividendJson) {
  const position = await requirePosition(symbol);
  const result = await prisma.dividend.updateMany({
    where: { id: dividendId, positionId: position.id },
    data: {
      exDate: parseDate(data.exDate),
      payDate: data.payDate ? parseDate(data.payDate) : null,
      amountPerShare: data.amountPerShare,
      quantity: data.quantity,
      note: data.note?.trim() ?? null,
    },
  });
  if (result.count === 0) throw new Error(`Dividend ${dividendId} not found`);
  const updated = await prisma.dividend.findUnique({ where: { id: dividendId } });
  if (!updated) throw new Error(`Dividend ${dividendId} not found`);
  return mapDividend(updated);
}

export async function deleteDividend(symbol: string, dividendId: string) {
  const position = await requirePosition(symbol);
  const result = await prisma.dividend.deleteMany({ where: { id: dividendId, positionId: position.id } });
  if (result.count === 0) throw new Error(`Dividend ${dividendId} not found`);
}

async function requirePosition(symbol: string) {
  const sym = normalizeSymbol(symbol);
  const position = await prisma.position.findUnique({ where: { symbol: sym } });
  if (!position) throw new Error(`Position ${sym} not found`);
  return position;
}