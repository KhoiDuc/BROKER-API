export type VnSession = "closed" | "lunch" | "ato" | "continuous" | "atc" | "plo";

const HOLIDAYS = new Set([
  "2025-01-01",
  "2025-01-27", "2025-01-28", "2025-01-29", "2025-01-30", "2025-01-31", "2025-02-01", "2025-02-02",
  "2025-04-07", "2025-04-30", "2025-05-01", "2025-09-01", "2025-09-02",
  "2026-01-01",
  "2026-02-14", "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21", "2026-02-22",
  "2026-04-26", "2026-04-30", "2026-05-01", "2026-09-02",
  "2027-01-01",
  "2027-02-05", "2027-02-06", "2027-02-07", "2027-02-08", "2027-02-09", "2027-02-10", "2027-02-11", "2027-02-12", "2027-02-13", "2027-02-14",
  "2027-04-16", "2027-04-30", "2027-05-01", "2027-09-02",
]);

export function tickVnd(exchange: string, priceVnd: number): number {
  const board = exchange.trim().toUpperCase();
  if (board === "HNX" || board === "UPCOM") return 100;
  if (priceVnd < 10_000) return 10;
  if (priceVnd < 50_000) return 50;
  return 100;
}

export function onTick(exchange: string, priceVnd: number): boolean {
  const step = tickVnd(exchange, priceVnd);
  return step > 0 && priceVnd % step === 0;
}

export function bandPercent(exchange: string): number {
  const board = exchange.trim().toUpperCase();
  if (board === "HNX") return 0.1;
  if (board === "UPCOM") return 0.15;
  return 0.07;
}

function roundToStep(priceVnd: number, step: number): number {
  return Math.round(priceVnd / step) * step;
}

export function bandFromRef(exchange: string, refVnd: number): { floorVnd: number; ceilVnd: number } {
  const pct = bandPercent(exchange);
  const floorRaw = refVnd * (1 - pct);
  const ceilRaw = refVnd * (1 + pct);
  return {
    floorVnd: roundToStep(floorRaw, tickVnd(exchange, floorRaw)),
    ceilVnd: roundToStep(ceilRaw, tickVnd(exchange, ceilRaw)),
  };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function vnClock(now: Date): { minutes: number; ymd: string; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = WEEKDAYS.indexOf(pick("weekday"));
  return {
    minutes: Number(pick("hour")) * 60 + Number(pick("minute")),
    ymd: `${pick("year")}-${pick("month")}-${pick("day")}`,
    weekday,
  };
}

export function isBusinessDay(now: Date): boolean {
  const clock = vnClock(now);
  if (clock.weekday === 0 || clock.weekday === 6) return false;
  return !HOLIDAYS.has(clock.ymd);
}

export function sessionAt(exchange: string, now: Date): VnSession {
  if (!isBusinessDay(now)) return "closed";
  const minutes = vnClock(now).minutes;
  const board = exchange.trim().toUpperCase() || "HOSE";
  if (minutes >= 11 * 60 + 30 && minutes < 13 * 60) return "lunch";
  if (board === "HOSE") {
    if (minutes >= 9 * 60 && minutes < 9 * 60 + 15) return "ato";
    if ((minutes >= 9 * 60 + 15 && minutes < 11 * 60 + 30) || (minutes >= 13 * 60 && minutes < 14 * 60 + 30)) return "continuous";
    if (minutes >= 14 * 60 + 30 && minutes < 14 * 60 + 45) return "atc";
    return "closed";
  }
  if (board === "HNX") {
    if ((minutes >= 9 * 60 && minutes < 11 * 60 + 30) || (minutes >= 13 * 60 && minutes < 14 * 60 + 30)) return "continuous";
    if (minutes >= 14 * 60 + 30 && minutes < 14 * 60 + 45) return "atc";
    if (minutes >= 14 * 60 + 45 && minutes < 15 * 60) return "plo";
    return "closed";
  }
  if ((minutes >= 9 * 60 && minutes < 11 * 60 + 30) || (minutes >= 13 * 60 && minutes < 15 * 60)) return "continuous";
  return "closed";
}

export function priceTypesFor(exchange: string, session: VnSession): string[] {
  const board = exchange.trim().toUpperCase();
  if (board === "HOSE" && session === "ato") return ["ATO"];
  if (board === "HOSE" && session === "continuous") return ["LO", "MP"];
  if (board === "HOSE" && session === "atc") return ["ATC"];
  if (board === "HNX" && session === "continuous") return ["LO", "MTL", "MOK", "MAK"];
  if (board === "HNX" && session === "atc") return ["ATC"];
  if (board === "HNX" && session === "plo") return ["PLO"];
  if (board === "UPCOM" && session === "continuous") return ["LO"];
  return ["LO"];
}

export function priceTypeAllowed(exchange: string, priceType: string, now: Date): boolean {
  const type = priceType.trim().toUpperCase();
  if (type === "LO") return true;
  return priceTypesFor(exchange, sessionAt(exchange, now)).includes(type);
}
