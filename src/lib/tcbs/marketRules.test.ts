import { describe, expect, it } from "vitest";
import { bandFromRef, onTick, priceTypeAllowed, sessionAt, tickVnd } from "./marketRules";

describe("marketRules", () => {
  it("uses HOSE and HNX tick sizes", () => {
    expect(tickVnd("HOSE", 9_500)).toBe(10);
    expect(tickVnd("HOSE", 10_000)).toBe(50);
    expect(tickVnd("HOSE", 50_000)).toBe(100);
    expect(tickVnd("HNX", 9_500)).toBe(100);
    expect(onTick("HOSE", 60_500)).toBe(true);
    expect(onTick("HOSE", 60_550)).toBe(false);
  });

  it("bands HOSE by 7 percent", () => {
    const band = bandFromRef("HOSE", 20_000);
    expect(band.floorVnd).toBe(18_600);
    expect(band.ceilVnd).toBe(21_400);
  });

  it("opens HOSE sessions on a Monday", () => {
    const ato = new Date("2026-03-02T02:05:00Z");
    const continuous = new Date("2026-03-02T02:30:00Z");
    const atc = new Date("2026-03-02T07:35:00Z");
    expect(sessionAt("HOSE", ato)).toBe("ato");
    expect(sessionAt("HOSE", continuous)).toBe("continuous");
    expect(sessionAt("HOSE", atc)).toBe("atc");
    expect(priceTypeAllowed("HOSE", "ATO", ato)).toBe(true);
    expect(priceTypeAllowed("HOSE", "ATO", continuous)).toBe(false);
    expect(priceTypeAllowed("HOSE", "LO", ato)).toBe(true);
  });
});
