import type {
  BuyLot,
  Dividend,
  Note,
  Position,
  PositionStatus as DbPositionStatus,
  NoteKind as DbNoteKind,
  LevelInputMode as DbLevelInputMode,
  Sell,
} from "@prisma/client";
import type {
  BrokerDividendJson,
  BrokerLotJson,
  BrokerNoteJson,
  BrokerPortfolioJson,
  BrokerPositionJson,
  BrokerSellJson,
  LevelInputMode,
  NoteKind,
  PositionStatus,
} from "./types";

type PositionWithChildren = Position & {
  buys: BuyLot[];
  sells: Sell[];
  notes: Note[];
  dividends: Dividend[];
};

function toNumber(value: { toNumber(): number } | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : value.toNumber();
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatDateTime(value: Date): string {
  return value.toISOString();
}

export function mapLot(lot: BuyLot): BrokerLotJson {
  return {
    id: lot.id,
    boughtAt: formatDate(lot.boughtAt),
    price: toNumber(lot.price) ?? 0,
    quantity: toNumber(lot.quantity),
    stopLoss: toNumber(lot.stopLoss),
    stopLossMode: lot.stopLossMode as LevelInputMode | null,
    stopLossInput: toNumber(lot.stopLossInput),
    targetPrice: toNumber(lot.targetPrice),
    targetPriceMode: lot.targetPriceMode as LevelInputMode | null,
    targetPriceInput: toNumber(lot.targetPriceInput),
    note: lot.note,
    tags: lot.tags,
  };
}

export function mapSell(sell: Sell): BrokerSellJson {
  return {
    id: sell.id,
    soldAt: formatDate(sell.soldAt),
    price: toNumber(sell.price) ?? 0,
    quantity: toNumber(sell.quantity),
    fee: toNumber(sell.fee),
    tax: toNumber(sell.tax),
    note: sell.note,
  };
}

export function mapNote(note: Note): BrokerNoteJson {
  return {
    id: note.id,
    at: formatDateTime(note.at),
    kind: note.kind as NoteKind,
    text: note.text,
    aiExplain: note.aiExplain,
  };
}

export function mapDividend(dividend: Dividend): BrokerDividendJson {
  return {
    id: dividend.id,
    exDate: formatDate(dividend.exDate),
    payDate: dividend.payDate ? formatDate(dividend.payDate) : null,
    amountPerShare: toNumber(dividend.amountPerShare) ?? 0,
    quantity: dividend.quantity,
    note: dividend.note,
  };
}

export function mapPosition(position: PositionWithChildren): BrokerPositionJson {
  return {
    symbol: position.symbol,
    sector: position.sector,
    status: position.status as PositionStatus,
    stopLoss: toNumber(position.stopLoss),
    stopLossMode: position.stopLossMode as LevelInputMode | null,
    stopLossInput: toNumber(position.stopLossInput),
    targetPrice: toNumber(position.targetPrice),
    targetPriceMode: position.targetPriceMode as LevelInputMode | null,
    targetPriceInput: toNumber(position.targetPriceInput),
    weightPct: toNumber(position.weightPct),
    entryLow: toNumber(position.entryLow),
    entryHigh: toNumber(position.entryHigh),
    recommendationText: position.recommendationText,
    buys: position.buys.map(mapLot),
    sells: position.sells.map(mapSell),
    notes: position.notes.map(mapNote),
    dividends: position.dividends.map(mapDividend),
    tags: position.tags,
  };
}

export function toBrokerPortfolio(rows: PositionWithChildren[]): BrokerPortfolioJson {
  const active = rows.filter((row) => !row.isArchived).map(mapPosition);
  const closed = rows.filter((row) => row.isArchived).map(mapPosition);
  const latest = rows.reduce<Date | null>((max, row) => {
    if (!max || row.updatedAt > max) return row.updatedAt;
    return max;
  }, null);

  return {
    updatedAt: (latest ?? new Date()).toISOString(),
    positions: active.sort((a, b) => a.symbol.localeCompare(b.symbol)),
    closedPositions: closed.sort((a, b) => a.symbol.localeCompare(b.symbol)),
  };
}

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

export type PositionUpsertInput = {
  symbol: string;
  sector: string;
  status: DbPositionStatus;
  stopLoss: number | null;
  stopLossMode: DbLevelInputMode | null;
  stopLossInput: number | null;
  targetPrice: number | null;
  targetPriceMode: DbLevelInputMode | null;
  targetPriceInput: number | null;
  weightPct: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  recommendationText: string | null;
  tags: string[];
  isArchived: boolean;
  buys: Array<{
    id: string;
    boughtAt: Date;
    price: number;
    quantity: number | null;
    stopLoss: number | null;
    stopLossMode: DbLevelInputMode | null;
    stopLossInput: number | null;
    targetPrice: number | null;
    targetPriceMode: DbLevelInputMode | null;
    targetPriceInput: number | null;
    note: string | null;
    tags: string[];
  }>;
  sells: Array<{
    id: string;
    soldAt: Date;
    price: number;
    quantity: number | null;
    fee: number | null;
    tax: number | null;
    note: string | null;
  }>;
  notes: Array<{
    id: string;
    at: Date;
    kind: DbNoteKind;
    text: string;
    aiExplain: string | null;
  }>;
  dividends: Array<{
    id: string;
    exDate: Date;
    payDate: Date | null;
    amountPerShare: number;
    quantity: number;
    note: string | null;
  }>;
};

export function fromBrokerPortfolio(portfolio: BrokerPortfolioJson): PositionUpsertInput[] {
  const open = (portfolio.positions ?? []).map((position) =>
    mapPositionJson(position, false),
  );
  const closed = (portfolio.closedPositions ?? []).map((position) =>
    mapPositionJson(position, true),
  );
  return [...open, ...closed];
}

function mapPositionJson(position: BrokerPositionJson, isArchived: boolean): PositionUpsertInput {
  const symbol = normalizeSymbol(position.symbol);
  return {
    symbol,
    sector: position.sector?.trim() ?? "",
    status: (position.status ?? "ChuaQuyet") as DbPositionStatus,
    stopLoss: position.stopLoss ?? null,
    stopLossMode: (position.stopLossMode ?? null) as DbLevelInputMode | null,
    stopLossInput: position.stopLossInput ?? null,
    targetPrice: position.targetPrice ?? null,
    targetPriceMode: (position.targetPriceMode ?? null) as DbLevelInputMode | null,
    targetPriceInput: position.targetPriceInput ?? null,
    weightPct: position.weightPct ?? null,
    entryLow: position.entryLow ?? null,
    entryHigh: position.entryHigh ?? null,
    recommendationText: position.recommendationText?.trim() ?? null,
    tags: position.tags ?? [],
    isArchived,
    buys: (position.buys ?? [])
      .filter((lot) => lot.price > 0)
      .map((lot) => ({
        id: ensureId(lot.id, `${symbol.toLowerCase()}b`),
        boughtAt: parseDate(lot.boughtAt),
        price: lot.price,
        quantity: lot.quantity ?? null,
        stopLoss: lot.stopLoss ?? null,
        stopLossMode: (lot.stopLossMode ?? null) as DbLevelInputMode | null,
        stopLossInput: lot.stopLossInput ?? null,
        targetPrice: lot.targetPrice ?? null,
        targetPriceMode: (lot.targetPriceMode ?? null) as DbLevelInputMode | null,
        targetPriceInput: lot.targetPriceInput ?? null,
        note: lot.note?.trim() ?? null,
        tags: lot.tags ?? [],
      })),
    sells: (position.sells ?? [])
      .filter((sell) => sell.price > 0)
      .map((sell) => ({
        id: ensureId(sell.id, `${symbol.toLowerCase()}s`),
        soldAt: parseDate(sell.soldAt),
        price: sell.price,
        quantity: sell.quantity ?? null,
        fee: sell.fee ?? null,
        tax: sell.tax ?? null,
        note: sell.note?.trim() ?? null,
      })),
    notes: (position.notes ?? []).map((note) => ({
      id: ensureId(note.id, `${symbol.toLowerCase()}n`),
      at: parseDate(note.at),
      kind: (note.kind ?? "Broker") as DbNoteKind,
      text: note.text?.trim() ?? "",
      aiExplain: note.aiExplain?.trim() ?? null,
    })),
    dividends: (position.dividends ?? []).map((dividend) => ({
      id: ensureId(dividend.id, `${symbol.toLowerCase()}d`),
      exDate: parseDate(dividend.exDate),
      payDate: dividend.payDate ? parseDate(dividend.payDate) : null,
      amountPerShare: dividend.amountPerShare,
      quantity: dividend.quantity,
      note: dividend.note?.trim() ?? null,
    })),
  };
}
