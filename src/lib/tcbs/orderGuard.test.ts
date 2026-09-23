import { describe, expect, it } from "vitest";
import { isDerivativeSymbol, toTcbsPrice, validateEquityOrder } from "./orderGuard";

describe("validateEquityOrder", () => {
  it("allows odd-lot LO and rejects odd-lot market orders", () => {
    expect(isDerivativeSymbol("VN30F1M")).toBe(true);
    const odd = validateEquityOrder({
      symbol: "VNM",
      execType: "NB",
      priceType: "LO",
      exchange: "HOSE",
      quantity: 50,
      price: 60.5,
      accountNo: "123",
    });
    expect(odd.ok).toBe(true);
    const market = validateEquityOrder({
      symbol: "VNM",
      execType: "NB",
      priceType: "MP",
      exchange: "HOSE",
      quantity: 50,
      price: 60.5,
      accountNo: "123",
      now: new Date("2026-03-02T02:30:00Z"),
    });
    expect(market.ok).toBe(false);
  });

  it("converts desk prices to VND", () => {
    expect(toTcbsPrice(60.5)).toEqual({ ok: true, vnd: 60500 });
    const order = validateEquityOrder({
      symbol: "VNM",
      execType: "NS",
      priceType: "LO",
      exchange: "HOSE",
      quantity: 100,
      price: 60.5,
      accountNo: "123",
    });
    expect(order.ok).toBe(true);
    if (order.ok) expect(order.order.priceVnd).toBe(60500);
  });
});
