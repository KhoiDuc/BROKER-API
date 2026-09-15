import { prisma } from "./prisma";
import { fromBrokerPortfolio, toBrokerPortfolio, type PositionUpsertInput } from "./mapper";
import type { BrokerPortfolioJson, BrokerPositionJson, BrokerLotJson, BrokerSellJson, BrokerNoteJson, BrokerDividendJson } from "./types";
import type { PositionStatus, NoteKind, LevelInputMode } from "@prisma/client";

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

export async function savePortfolio(portfolio: BrokerPortfolioJson) {
  const positions = fromBrokerPortfolio(portfolio);
  console.log(`[portfolio-service] Import ${positions.length} positions — delete-all + create…`);

  try {
    await prisma.$transaction([
      prisma.buyLot.deleteMany({}),
      prisma.sell.deleteMany({}),
      prisma.note.deleteMany({}),
      prisma.dividend.deleteMany({}),
      prisma.position.deleteMany({}),
    ]);

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

    console.log(`[portfolio-service] Import OK — ${positions.length} positions created`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[portfolio-service] Import FAIL:", msg);
    throw new Error(`Import failed: ${msg}`);
  }

  return getPortfolio();
}

// ── Position CRUD ──

function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function ensureId(id: string | undefined, prefix: string): string {
  if (id && id.trim()) return id.trim();
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`;
}

export async function createPosition(data: BrokerPositionJson) {
  const symbol = normalizeSymbol(data.symbol);
  return prisma.position.create({
    data: {
      symbol,
      sector: data.sector?.trim() ?? "",
      status: (data.status ?? "ChuaQuyet") as PositionStatus,
      stopLoss: data.stopLoss ?? null,
      stopLossMode: (data.stopLossMode ?? null) as LevelInputMode | null,
      stopLossInput: data.stopLossInput ?? null,
      targetPrice: data.targetPrice ?? null,
      targetPriceMode: (data.targetPriceMode ?? null) as LevelInputMode | null,
      targetPriceInput: data.targetPriceInput ?? null,
      weightPct: data.weightPct ?? null,
      entryLow: data.entryLow ?? null,
      entryHigh: data.entryHigh ?? null,
      recommendationText: data.recommendationText?.trim() ?? null,
      tags: data.tags ?? [],
      isArchived: false,
      buys: { create: (data.buys ?? []).filter(l => l.price > 0).map(lot => ({
        id: ensureId(lot.id, `${symbol.toLowerCase()}b`),
        boughtAt: parseDate(lot.boughtAt),
        price: lot.price,
        quantity: lot.quantity ?? null,
        stopLoss: lot.stopLoss ?? null,
        stopLossMode: (lot.stopLossMode ?? null) as LevelInputMode | null,
        stopLossInput: lot.stopLossInput ?? null,
        targetPrice: lot.targetPrice ?? null,
        targetPriceMode: (lot.targetPriceMode ?? null) as LevelInputMode | null,
        targetPriceInput: lot.targetPriceInput ?? null,
        note: lot.note?.trim() ?? null,
        tags: lot.tags ?? [],
      }))},
      sells: { create: (data.sells ?? []).filter(s => s.price > 0).map(sell => ({
        id: ensureId(sell.id, `${symbol.toLowerCase()}s`),
        soldAt: parseDate(sell.soldAt),
        price: sell.price,
        quantity: sell.quantity ?? null,
        fee: sell.fee ?? null,
        tax: sell.tax ?? null,
        note: sell.note?.trim() ?? null,
      }))},
      notes: { create: (data.notes ?? []).map(note => ({
        id: ensureId(note.id, `${symbol.toLowerCase()}n`),
        at: parseDate(note.at),
        kind: (note.kind ?? "Broker") as NoteKind,
        text: note.text?.trim() ?? "",
        aiExplain: note.aiExplain?.trim() ?? null,
      }))},
      dividends: { create: (data.dividends ?? []).map(div => ({
        id: ensureId(div.id, `${symbol.toLowerCase()}d`),
        exDate: parseDate(div.exDate),
        payDate: div.payDate ? parseDate(div.payDate) : null,
        amountPerShare: div.amountPerShare,
        quantity: div.quantity,
        note: div.note?.trim() ?? null,
      }))},
    },
    include: positionInclude,
  });
}

export async function updatePosition(symbol: string, data: BrokerPositionJson) {
  const sym = normalizeSymbol(symbol);
  return prisma.position.update({
    where: { symbol: sym },
    data: {
      sector: data.sector?.trim() ?? "",
      status: (data.status ?? "ChuaQuyet") as PositionStatus,
      stopLoss: data.stopLoss ?? null,
      stopLossMode: (data.stopLossMode ?? null) as LevelInputMode | null,
      stopLossInput: data.stopLossInput ?? null,
      targetPrice: data.targetPrice ?? null,
      targetPriceMode: (data.targetPriceMode ?? null) as LevelInputMode | null,
      targetPriceInput: data.targetPriceInput ?? null,
      weightPct: data.weightPct ?? null,
      entryLow: data.entryLow ?? null,
      entryHigh: data.entryHigh ?? null,
      recommendationText: data.recommendationText?.trim() ?? null,
      tags: data.tags ?? [],
      isArchived: data.status ? false : undefined, // don't change isArchived on plain update
    },
    include: positionInclude,
  });
}

export async function deletePosition(symbol: string) {
  const sym = normalizeSymbol(symbol);
  await prisma.position.delete({ where: { symbol: sym } });
}

export async function archivePosition(symbol: string, isArchived: boolean) {
  const sym = normalizeSymbol(symbol);
  return prisma.position.update({
    where: { symbol: sym },
    data: { isArchived },
    include: positionInclude,
  });
}

// ── BuyLot CRUD ──

export async function addLot(symbol: string, data: BrokerLotJson) {
  const sym = normalizeSymbol(symbol);
  const position = await prisma.position.findUnique({ where: { symbol: sym } });
  if (!position) throw new Error(`Position ${sym} not found`);

  return prisma.buyLot.create({
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
}

export async function updateLot(symbol: string, lotId: string, data: BrokerLotJson) {
  const sym = normalizeSymbol(symbol);
  const position = await prisma.position.findUnique({ where: { symbol: sym } });
  if (!position) throw new Error(`Position ${sym} not found`);

  return prisma.buyLot.update({
    where: { id: lotId },
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
}

export async function deleteLot(symbol: string, lotId: string) {
  await prisma.buyLot.delete({ where: { id: lotId } });
}

// ── Sell CRUD ──

export async function addSell(symbol: string, data: BrokerSellJson) {
  const sym = normalizeSymbol(symbol);
  const position = await prisma.position.findUnique({ where: { symbol: sym } });
  if (!position) throw new Error(`Position ${sym} not found`);

  return prisma.sell.create({
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
}

export async function updateSell(symbol: string, sellId: string, data: BrokerSellJson) {
  return prisma.sell.update({
    where: { id: sellId },
    data: {
      soldAt: parseDate(data.soldAt),
      price: data.price,
      quantity: data.quantity ?? null,
      fee: data.fee ?? null,
      tax: data.tax ?? null,
      note: data.note?.trim() ?? null,
    },
  });
}

export async function deleteSell(symbol: string, sellId: string) {
  await prisma.sell.delete({ where: { id: sellId } });
}

// ── Note CRUD ──

export async function addNote(symbol: string, data: BrokerNoteJson) {
  const sym = normalizeSymbol(symbol);
  const position = await prisma.position.findUnique({ where: { symbol: sym } });
  if (!position) throw new Error(`Position ${sym} not found`);

  return prisma.note.create({
    data: {
      id: ensureId(data.id, `${sym.toLowerCase()}n`),
      positionId: position.id,
      at: parseDate(data.at),
      kind: (data.kind ?? "Broker") as NoteKind,
      text: data.text?.trim() ?? "",
      aiExplain: data.aiExplain?.trim() ?? null,
    },
  });
}

export async function updateNote(symbol: string, noteId: string, data: BrokerNoteJson) {
  return prisma.note.update({
    where: { id: noteId },
    data: {
      at: parseDate(data.at),
      kind: (data.kind ?? "Broker") as NoteKind,
      text: data.text?.trim() ?? "",
      aiExplain: data.aiExplain?.trim() ?? null,
    },
  });
}

export async function deleteNote(symbol: string, noteId: string) {
  await prisma.note.delete({ where: { id: noteId } });
}

// ── Dividend CRUD ──

export async function addDividend(symbol: string, data: BrokerDividendJson) {
  const sym = normalizeSymbol(symbol);
  const position = await prisma.position.findUnique({ where: { symbol: sym } });
  if (!position) throw new Error(`Position ${sym} not found`);

  return prisma.dividend.create({
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
}

export async function deleteDividend(symbol: string, dividendId: string) {
  await prisma.dividend.delete({ where: { id: dividendId } });
}