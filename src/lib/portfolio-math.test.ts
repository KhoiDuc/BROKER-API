import { describe, expect, it } from "vitest";
import { portfolioToCsv, diffCsvImport, parsePortfolioCsv } from "./csv-portfolio";
import { summarizePortfolio } from "./portfolio-math";
import { ensureId } from "./mapper";
import { secretsEqual } from "./secrets";
import type { BrokerPortfolioJson } from "./types";

const portfolio: BrokerPortfolioJson = {
  updatedAt: "2026-01-01T00:00:00.000Z",
  positions: [
    {
      symbol: "VNM",
      sector: "Consumer",
      status: "NamGiu",
      buys: [{ id: "b1", boughtAt: "2026-01-01", price: 60, quantity: 100 }],
      sells: [{ id: "s1", soldAt: "2026-02-01", price: 70, quantity: 40, fee: 10, tax: 5 }],
      dividends: [{ id: "d1", exDate: "2026-03-01", amountPerShare: 1, quantity: 60 }],
    },
  ],
};

describe("portfolio math and csv", () => {
  it("computes realized pnl and dividends", () => {
    const summary = summarizePortfolio(portfolio, { VNM: 80 });
    expect(summary.realizedPnl).toBeCloseTo(70 * 40 - 10 - 5 - 60 * 40);
    expect(summary.dividendIncome).toBe(60);
    expect(summary.unrealizedPnl).toBeCloseTo(80 * 60 - 60 * 60);
  });

  it("round-trips csv symbols", () => {
    const csv = portfolioToCsv(portfolio);
    const rows = parsePortfolioCsv(csv);
    const diff = diffCsvImport(portfolio, rows);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(rows.some((row) => row.kind === "buy" && row.symbol === "VNM")).toBe(true);
  });

  it("uses random ids and constant-time secret compare", () => {
    expect(ensureId(undefined, "vnm")).not.toBe(ensureId(undefined, "vnm"));
    expect(ensureId("keep", "vnm")).toBe("keep");
    expect(secretsEqual("same", "same")).toBe(true);
    expect(secretsEqual("same", "other")).toBe(false);
  });
});
