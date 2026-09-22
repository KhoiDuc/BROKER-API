const base = () => (process.env.TCBS_OPENAPI_BASE || "https://openapi.tcbs.com.vn").replace(/\/$/, "");

export class TcbsReauth extends Error {
  constructor() {
    super("TCBS_REAUTH");
  }
}

export async function exchangeToken(apiKey: string, otp: string): Promise<string> {
  const resp = await fetch(`${base()}/gaia/v1/oauth2/openapi/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ apiKey, otp }),
  });
  const text = await resp.text();
  let json: { token?: string; message?: string; error?: string } | null = null;
  try {
    json = text ? (JSON.parse(text) as { token?: string; message?: string; error?: string }) : null;
  } catch {
    json = null;
  }
  if (!resp.ok || !json?.token) {
    throw new Error(json?.message || json?.error || "TCBS từ chối API key hoặc iOTP.");
  }
  return json.token;
}

export function readJwtExp(token: string): Date | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const pad = part.length % 4 === 0 ? "" : "=".repeat(4 - (part.length % 4));
    const json = JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8")) as {
      exp?: number;
      custodyCode?: string;
      custodycd?: string;
    };
    return json.exp ? new Date(json.exp * 1000) : null;
  } catch {
    return null;
  }
}

export function readJwtCustody(token: string): string {
  try {
    const part = token.split(".")[1];
    if (!part) return "";
    const pad = part.length % 4 === 0 ? "" : "=".repeat(4 - (part.length % 4));
    const json = JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8")) as Record<string, unknown>;
    for (const key of ["custodyCode", "custodycd", "custodyId", "username"]) {
      const v = json[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  } catch {
    /* ignore */
  }
  return "";
}

export async function tcbsFetch(
  token: string,
  tokenExp: Date | null,
  method: string,
  pathname: string,
  opts?: { query?: Record<string, string | number | undefined | null>; body?: unknown },
): Promise<unknown> {
  if (!token) throw new TcbsReauth();
  if (tokenExp && tokenExp.getTime() < Date.now()) throw new TcbsReauth();

  const url = new URL(base() + pathname);
  if (opts?.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: opts?.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await resp.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  if (resp.status === 401 || resp.status === 403) throw new TcbsReauth();
  if (!resp.ok) {
    const obj = json as { message?: string; error?: string } | null;
    const err = new Error(obj?.message || obj?.error || text || resp.statusText);
    throw err;
  }
  return json;
}

export function wsUpstream(stream: string): string | null {
  const map: Record<string, string> = {
    normal: process.env.TCBS_WS_NORMAL || "wss://openapi.tcbs.com.vn/ws/thesis/v1/stream/normal",
    orders: process.env.TCBS_WS_ORDERS || "wss://openapi.tcbs.com.vn/ws/aither",
    flow: process.env.TCBS_WS_FLOW || "wss://openapi.tcbs.com.vn/ws/ouranos/v1/stream",
  };
  return map[stream] ?? null;
}
