import type { BrokerPortfolioJson, BrokerPositionJson } from "./types";

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

export function diffCsvImport(current: BrokerPortfolioJson, rows: CsvImportRow[]) {
  const existing = new Set([
    ...(current.positions ?? []).map((p) => p.symbol.toUpperCase()),
    ...(current.closedPositions ?? []).map((p) => p.symbol.toUpperCase()),
  ]);
  const incoming = new Set(rows.map((row) => row.symbol).filter(Boolean));
  const added = [...incoming].filter((symbol) => !existing.has(symbol));
  const removed = [...existing].filter((symbol) => !incoming.has(symbol));
  const unchanged = [...incoming].filter((symbol) => existing.has(symbol));
  return { added, removed, unchanged, rowCount: rows.length };
}
