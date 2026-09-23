/** Latest close from the public VNDirect finfo API. */
export async function fetchLastPrice(symbol: string): Promise<number | null> {
  const url = `https://api-finfo.vndirect.com.vn/v4/stock_prices?sort=date:desc&q=code:${encodeURIComponent(symbol)}&size=1&type=summary`;
  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  if (!resp.ok) return null;
  const json = (await resp.json()) as { data?: { close?: number }[] };
  const close = json.data?.[0]?.close;
  return typeof close === "number" && Number.isFinite(close) ? close : null;
}
