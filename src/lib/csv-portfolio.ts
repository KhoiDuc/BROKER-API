import { createHash, randomUUID } from "crypto";
import type { BrokerPortfolioJson, BrokerPositionJson, PositionStatus } from "./types";

const STATUSES = new Set<string>(["ChuaQuyet", "ChoMua", "NamGiu", "CatLo", "ChotLoi", "BoTheoDoi", "DaDong"]);

function cell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function row(values: Array<string | number | null | undefined>): string {
  return values.map(cell).join(",");
}

const HEADER = "symbol,sector,status,kind,date,price,quantity,fee,tax,amountPerShare,note";

export function portfolioToCsv(portfolio: BrokerPortfolioJson): string {
  const lines = [HEADER];
  const write = (position: BrokerPositionJson) => {
    lines.push(row([position.symbol, position.sector ?? "", position.status, "position", "", "", "", "", "", "", position.recommendationText ?? ""]));
    for (const lot of position.buys ?? []) {
      lines.push(row([position.symbol, position.sector ?? "", position.status, "buy", lot.boughtAt, lot.price, lot.quantity ?? "", "", "", "", lot.note ?? ""]));
    }
    for (const sell of position.sells ?? []) {
      lines.push(row([position.symbol, position.sector ?? "", position.status, "sell", sell.soldAt, sell.price, sell.quantity ?? "", sell.fee ?? "", sell.tax ?? "", "", sell.note ?? ""]));
    }
    for (const dividend of position.dividends ?? []) {
      lines.push(row([position.symbol, position.sector ?? "", position.status, "dividend", dividend.exDate, "", dividend.quantity, "", "", dividend.amountPerShare, dividend.note ?? ""]));
    }
  };
  for (const position of portfolio.positions ?? []) write(position);
  for (const position of portfolio.closedPositions ?? []) write(position);
  return lines.join("\n");
}

export type CsvImportRow = {
  symbol: string;
  sector: string;
  status: string;
  kind: string;
  date: string;
  price: string;
  quantity: string;
  fee: string;
  tax: string;
  amountPerShare: string;
  note: string;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      current.push(field);
      field = "";
    } else if (ch === "\n") {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

export function parsePortfolioCsv(text: string): CsvImportRow[] {
  const table = parseCsv(text.trim());
  if (table.length === 0) return [];
  const header = table[0].map((cell) => cell.trim());
  const index = (name: string) => header.indexOf(name);
  return table.slice(1).map((cells) => ({
    symbol: cells[index("symbol")]?.trim().toUpperCase() ?? "",
    sector: cells[index("sector")]?.trim() ?? "",
    status: cells[index("status")]?.trim() ?? "",
    kind: cells[index("kind")]?.trim().toLowerCase() ?? "",
    date: cells[index("date")]?.trim() ?? "",
    price: cells[index("price")]?.trim() ?? "",
    quantity: cells[index("quantity")]?.trim() ?? "",
    fee: cells[index("fee")]?.trim() ?? "",
    tax: cells[index("tax")]?.trim() ?? "",
    amountPerShare: cells[index("amountPerShare")]?.trim() ?? "",
    note: cells[index("note")]?.trim() ?? "",
  }));
}

function asNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStatus(value: string): PositionStatus {
  return (STATUSES.has(value) ? value : "ChuaQuyet") as PositionStatus;
}

export function rowsToPortfolio(rows: CsvImportRow[]): BrokerPortfolioJson {
  const bySymbol = new Map<string, BrokerPositionJson>();
  for (const row of rows) {
    if (!row.symbol) continue;
    let position = bySymbol.get(row.symbol);
    if (!position) {
      position = {
        symbol: row.symbol,
        sector: row.sector,
        status: asStatus(row.status),
        buys: [],
        sells: [],
        dividends: [],
        recommendationText: null,
      };
      bySymbol.set(row.symbol, position);
    }
    if (row.sector) position.sector = row.sector;
    if (STATUSES.has(row.status)) position.status = asStatus(row.status);
    if (row.kind === "position" && row.note) position.recommendationText = row.note;
    if (row.kind === "buy") {
      position.buys.push({
        id: randomUUID(),
        boughtAt: row.date || new Date().toISOString(),
        price: asNumber(row.price) ?? 0,
        quantity: asNumber(row.quantity),
        note: row.note || null,
      });
    }
    if (row.kind === "sell") {
      position.sells ??= [];
      position.sells.push({
        id: randomUUID(),
        soldAt: row.date || new Date().toISOString(),
        price: asNumber(row.price) ?? 0,
        quantity: asNumber(row.quantity),
        fee: asNumber(row.fee),
        tax: asNumber(row.tax),
        note: row.note || null,
      });
    }
    if (row.kind === "dividend") {
      position.dividends ??= [];
      position.dividends.push({
        id: randomUUID(),
        exDate: row.date || new Date().toISOString(),
        amountPerShare: asNumber(row.amountPerShare) ?? 0,
        quantity: asNumber(row.quantity) ?? 0,
        note: row.note || null,
      });
    }
  }
  const all = [...bySymbol.values()];
  return {
    updatedAt: new Date().toISOString(),
    positions: all.filter((position) => position.status !== "DaDong"),
    closedPositions: all.filter((position) => position.status === "DaDong"),
  };
}

export function previewHash(rows: CsvImportRow[]): string {
  const stable = [...rows]
    .map((row) => ({ ...row }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function childCounts(position: BrokerPositionJson | undefined) {
  return {
    buys: position?.buys?.length ?? 0,
    sells: position?.sells?.length ?? 0,
    dividends: position?.dividends?.length ?? 0,
  };
}

export function diffCsvImport(current: BrokerPortfolioJson, rows: CsvImportRow[]) {
  const currentPositions = [...(current.positions ?? []), ...(current.closedPositions ?? [])];
  const bySymbol = new Map(currentPositions.map((position) => [position.symbol.toUpperCase(), position]));
  const existing = new Set(bySymbol.keys());
  const incoming = new Set(rows.map((row) => row.symbol).filter(Boolean));
  const added = [...incoming].filter((symbol) => !existing.has(symbol));
  const removed = [...existing].filter((symbol) => !incoming.has(symbol));
  const unchanged = [...incoming].filter((symbol) => existing.has(symbol));
  const symbols = [...new Set([...existing, ...incoming])].sort();
  const details = symbols.map((symbol) => {
    const mine = rows.filter((row) => row.symbol === symbol);
    return {
      symbol,
      before: childCounts(bySymbol.get(symbol)),
      after: {
        buys: mine.filter((row) => row.kind === "buy").length,
        sells: mine.filter((row) => row.kind === "sell").length,
        dividends: mine.filter((row) => row.kind === "dividend").length,
      },
    };
  });
  return { added, removed, unchanged, details, rowCount: rows.length, previewHash: previewHash(rows) };
}
