const EXCHANGES = new Set(["HOSE", "HNX", "UPCOM"]);
const PRICE_TYPES = new Set(["LO", "ATO", "ATC", "PLO", "MP", "MTL", "MOK", "MAK"]);
const EXEC_TYPES = new Set(["NB", "NS"]);
const MARKET_PRICE_TYPES = new Set(["ATO", "ATC", "PLO", "MP", "MTL", "MOK", "MAK"]);
const DERIVATIVE_RE = /VN30F|VN100F|GB\d|VGB|DERIVATIVE|FUTURE/i;

export type EquityOrder = {
  symbol: string;
  execType: "NB" | "NS";
  priceType: string;
  exchange: string;
  quantity: number;
  priceVnd: number;
  notional: number;
  accountNo: string;
};

export function isDerivativeSymbol(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  if (!s) return false;
  if (DERIVATIVE_RE.test(s)) return true;
  return /^[A-Z]{1,6}\d{2}F\d{0,4}$/.test(s);
}

export function isDerivativeAccount(accountType: string | null | undefined): boolean {
  return String(accountType ?? "").toUpperCase().includes("DERIV");
}

/** Desk prices are thousands of VND (60.5). TCBS expects VND (60500). */
export function toTcbsPrice(price: unknown): { ok: true; vnd: number } | { ok: false; error: string } {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return { ok: false, error: "Giá phải > 0." };
  const vnd = n < 1000 ? Math.round(n * 1000) : Math.round(n);
  if (vnd <= 0) return { ok: false, error: "Giá không hợp lệ." };
  return { ok: true, vnd };
}

export function toDeskPrice(vnd: number): number {
  if (!Number.isFinite(vnd) || vnd <= 0) return 0;
  return vnd >= 1000 ? vnd / 1000 : vnd;
}

export function maxOrderVnd(): number {
  const n = Number(process.env.TCBS_MAX_ORDER_VND || 500_000_000);
  return Number.isFinite(n) && n > 0 ? n : 500_000_000;
}

export function validateEquityOrder(input: {
  symbol?: unknown;
  execType?: unknown;
  priceType?: unknown;
  exchange?: unknown;
  quantity?: unknown;
  price?: unknown;
  accountNo?: unknown;
  accountType?: unknown;
}): { ok: true; order: EquityOrder } | { ok: false; error: string } {
  const symbol = String(input.symbol ?? "").trim().toUpperCase();
  const execType = String(input.execType ?? "").trim().toUpperCase();
  const priceType = String(input.priceType ?? "LO").trim().toUpperCase();
  const exchange = String(input.exchange ?? "").trim().toUpperCase();
  const quantity = Number(input.quantity);
  const accountNo = String(input.accountNo ?? "").trim();

  if (!/^[A-Z0-9]{3,10}$/.test(symbol)) return { ok: false, error: "Mã chỉ gồm chữ và số, 3–10 ký tự." };
  if (isDerivativeSymbol(symbol) || isDerivativeAccount(String(input.accountType ?? ""))) {
    return { ok: false, error: "Không hỗ trợ chứng khoán phái sinh." };
  }
  if (!EXEC_TYPES.has(execType)) return { ok: false, error: "Chiều lệnh chỉ NB (mua) hoặc NS (bán)." };
  if (!PRICE_TYPES.has(priceType)) return { ok: false, error: "Loại giá không hợp lệ." };
  if (exchange && !EXCHANGES.has(exchange)) return { ok: false, error: "Chỉ đặt lệnh sàn HOSE, HNX hoặc UPCOM." };
  if (!accountNo) return { ok: false, error: "Thiếu số tiểu khoản." };
  if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, error: "Khối lượng phải là số nguyên > 0." };
  if (quantity % 100 !== 0) return { ok: false, error: "Khối lượng phải là bội số của 100 (lô chẵn)." };

  const market = MARKET_PRICE_TYPES.has(priceType);
  const priced = toTcbsPrice(market ? input.price || 0.01 : input.price);
  if (!market && !priced.ok) return priced;
  const priceVnd = priced.ok ? priced.vnd : 0;
  const notional = market ? 0 : priceVnd * quantity;
  const max = maxOrderVnd();
  if (!market && notional > max) {
    return { ok: false, error: `Giá trị lệnh vượt hạn mức ${max.toLocaleString("vi-VN")} VND.` };
  }

  return {
    ok: true,
    order: {
      symbol,
      execType: execType as "NB" | "NS",
      priceType,
      exchange,
      quantity,
      priceVnd,
      notional,
      accountNo,
    },
  };
}

export function estimateCost(order: EquityOrder) {
  const feeRate = Number(process.env.TCBS_FEE_RATE || 0.0015);
  const taxRate = order.execType === "NS" ? Number(process.env.TCBS_SELL_TAX || 0.001) : 0;
  const fee = Math.round(order.notional * feeRate);
  const tax = Math.round(order.notional * taxRate);
  return {
    notional: order.notional,
    fee,
    tax,
    total: order.execType === "NB" ? order.notional + fee : order.notional - fee - tax,
  };
}

export function orderHash(order: EquityOrder): string {
  return [
    order.accountNo,
    order.symbol,
    order.execType,
    order.priceType,
    order.quantity,
    order.priceVnd,
    order.exchange,
  ].join("|");
}
