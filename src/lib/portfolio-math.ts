import type { BrokerPortfolioJson, BrokerPositionJson } from "./types";

export type PortfolioSummary = {
  nav: number;
  realizedPnl: number;
  unrealizedPnl: number | null;
  dividendIncome: number;
  breakdown: {
    costOpen: number;
    market: number;
    sectors: Record<string, number>;
  };
};

function qtyOf(value: number | null | undefined): number {
  return value && value > 0 ? value : 0;
}

function summarizePosition(position: BrokerPositionJson, mark: number | undefined) {
  let boughtQty = 0;
  let cost = 0;
  for (const lot of position.buys ?? []) {
    const q = qtyOf(lot.quantity);
    boughtQty += q;
    cost += q * lot.price;
  }
  let soldQty = 0;
  let proceeds = 0;
  for (const sell of position.sells ?? []) {
    const q = qtyOf(sell.quantity);
    soldQty += q;
    proceeds += q * sell.price - (sell.fee ?? 0) - (sell.tax ?? 0);
  }
  const avg = boughtQty > 0 ? cost / boughtQty : 0;
  const openQty = Math.max(0, boughtQty - soldQty);
  const realized = proceeds - avg * Math.min(soldQty, boughtQty);
  const costOpen = avg * openQty;
  const priced = mark != null && Number.isFinite(mark) ? mark * openQty : costOpen;
  let dividendIncome = 0;
  for (const dividend of position.dividends ?? []) {
    dividendIncome += dividend.amountPerShare * dividend.quantity;
  }
  return { realized, costOpen, market: priced, dividendIncome, sector: position.sector?.trim() || "Other" };
}

export function summarizePortfolio(portfolio: BrokerPortfolioJson, marks?: Record<string, number>): PortfolioSummary {
  const sectors: Record<string, number> = {};
  let realizedPnl = 0;
  let costOpen = 0;
  let market = 0;
  let dividendIncome = 0;
  const rows = [...(portfolio.positions ?? []), ...(portfolio.closedPositions ?? [])];
  for (const position of rows) {
    const row = summarizePosition(position, marks?.[position.symbol.toUpperCase()]);
    realizedPnl += row.realized;
    costOpen += row.costOpen;
    market += row.market;
    dividendIncome += row.dividendIncome;
    sectors[row.sector] = (sectors[row.sector] ?? 0) + row.costOpen;
  }
  const hasMarks = Boolean(marks && Object.keys(marks).length > 0);
  return {
    nav: market + dividendIncome,
    realizedPnl,
    unrealizedPnl: hasMarks ? market - costOpen : null,
    dividendIncome,
    breakdown: { costOpen, market, sectors },
  };
}
