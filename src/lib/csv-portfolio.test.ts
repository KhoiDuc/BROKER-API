import { describe, expect, it } from "vitest";
import { previewHash, rowsToPortfolio } from "./csv-portfolio";

describe("rowsToPortfolio", () => {
  it("groups buys and closed symbols", () => {
    const rows = [
      { symbol: "VNM", sector: "Food", status: "NamGiu", kind: "buy", date: "2026-03-02", price: "60.5", quantity: "100", fee: "", tax: "", amountPerShare: "", note: "" },
      { symbol: "FPT", sector: "Tech", status: "DaDong", kind: "sell", date: "2026-03-03", price: "120", quantity: "100", fee: "1", tax: "1", amountPerShare: "", note: "" },
    ];
    const portfolio = rowsToPortfolio(rows);
    expect(portfolio.positions).toHaveLength(1);
    expect(portfolio.positions[0].buys).toHaveLength(1);
    expect(portfolio.closedPositions).toHaveLength(1);
    expect(previewHash(rows)).toBe(previewHash(rows));
  });
});
