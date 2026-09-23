import { describe, expect, it } from "vitest";
import { isDerivativeSymbol, toTcbsPrice, validateEquityOrder } from "./orderGuard";

describe("validateEquityOrder", () => {
  it("rejects odd lots and derivatives", () => {
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
    expect(odd.ok).toBe(false);
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
