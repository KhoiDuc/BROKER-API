import { isDerivativeSymbol, toTcbsPrice, validateEquityOrder } from "./orderGuard";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(toTcbsPrice(60.5).ok && (toTcbsPrice(60.5) as { vnd: number }).vnd === 60500, "scale thousands");
assert(toTcbsPrice(60500).ok && (toTcbsPrice(60500) as { vnd: number }).vnd === 60500, "keep vnd");
assert(!toTcbsPrice(0).ok, "reject zero");
assert(isDerivativeSymbol("VN30F1M"), "futures symbol");
assert(!isDerivativeSymbol("VNM"), "equity symbol");

const odd = validateEquityOrder({
  symbol: "VNM",
  execType: "NB",
  priceType: "LO",
  exchange: "HOSE",
  quantity: 50,
  price: 60.5,
  accountNo: "0001",
});
assert(!odd.ok, "odd lot");

const deriv = validateEquityOrder({
  symbol: "VN30F2509",
  execType: "NB",
  priceType: "LO",
  exchange: "HOSE",
  quantity: 100,
  price: 1000,
  accountNo: "0001",
});
assert(!deriv.ok, "derivative order");

const ok = validateEquityOrder({
  symbol: "fpt",
  execType: "NS",
  priceType: "LO",
  exchange: "HOSE",
  quantity: 100,
  price: 120.5,
  accountNo: "0001",
});
if (!ok.ok) throw new Error("valid sell");
assert(ok.order.priceVnd === 120500 && ok.order.symbol === "FPT", "valid sell");

const huge = validateEquityOrder({
  symbol: "VNM",
  execType: "NB",
  priceType: "LO",
  exchange: "HOSE",
  quantity: 100000,
  price: 200,
  accountNo: "0001",
});
assert(!huge.ok, "notional cap");

console.log("tcbs order guard ok");
