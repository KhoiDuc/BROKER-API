import { extractBearerToken, verifyAccessToken } from "@/lib/auth";
import { claimIdempotency, completeIdempotency, releaseIdempotency } from "@/lib/idempotency";
import {
  badRequestResponse,
  corsPreflightResponse,
  jsonResponse,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/guard";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { isApiKeyToken, secretsEqual } from "@/lib/secrets";
import { randomId } from "@/lib/tcbs/crypto";
import { TcbsReauth, exchangeToken, readJwtCustody, readJwtExp, tcbsFetch, wsUpstream } from "@/lib/tcbs/client";
import { estimateCost, isDerivativeAccount, orderHash, validateEquityOrder, type EquityOrder } from "@/lib/tcbs/orderGuard";
import {
  deleteTcbsSession,
  loadApiKey,
  loadSession,
  markReauth,
  pushAudit,
  rotateToken,
  saveConnected,
  updateSession,
  type TcbsSessionView,
} from "@/lib/tcbs/session";
import { issueWsTicket, redeemWsTicket } from "@/lib/tcbs/tickets";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: Promise<{ slug?: string[] }> };

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

async function usernameOf(request: Request): Promise<string | Response> {
  const token = extractBearerToken(request);
  if (!token) return unauthorizedResponse(request);
  if (isApiKeyToken(token)) return "api-key";
  const payload = await verifyAccessToken(token);
  if (!payload) return unauthorizedResponse(request);
  return payload.username;
}

function reauth(request: Request) {
  return jsonResponse({ error: "TCBS_REAUTH", code: "TCBS_REAUTH" }, request, { status: 409 });
}

function accountNoOf(request: Request, session: TcbsSessionView): string {
  return new URL(request.url).searchParams.get("accountNo")?.trim() || session.accountNo;
}

async function withSession(request: Request, username: string): Promise<TcbsSessionView | Response> {
  const session = await loadSession(username);
  if (!session || session.needsReauth || !session.token) return reauth(request);
  return session;
}

async function callTcbs(username: string, session: TcbsSessionView, request: Request, run: () => Promise<unknown>) {
  try {
    return jsonResponse(await run(), request);
  } catch (error) {
    if (error instanceof TcbsReauth) {
      await markReauth(username);
      return reauth(request);
    }
    const message = error instanceof Error ? error.message : "TCBS request failed";
    return serverErrorResponse(message, request);
  }
}

function pickEquityAccount(profile: unknown): string {
  const accounts = findAccounts(profile);
  const equity = accounts.find((a) => !isDerivativeAccount(a.type) && a.accountNo);
  const preferred = equity ?? accounts.find((a) => a.isDefault && !isDerivativeAccount(a.type));
  return preferred?.accountNo ?? equity?.accountNo ?? "";
}

function findAccounts(node: unknown, out: { accountNo: string; type: string; isDefault: boolean }[] = []): { accountNo: string; type: string; isDefault: boolean }[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) findAccounts(item, out);
    return out;
  }
  const obj = node as Record<string, unknown>;
  const accountNo = String(obj.accountNo ?? obj.acctno ?? "").trim();
  if (accountNo) {
    out.push({
      accountNo,
      type: String(obj.accountType ?? obj.accountTypeName ?? obj.aftype ?? ""),
      isDefault: String(obj.isDefault ?? "").toUpperCase() === "Y",
    });
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") findAccounts(value, out);
  }
  return out;
}

function findExchange(node: unknown, symbol: string): string {
  if (!node || typeof node !== "object") return "";
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findExchange(item, symbol);
      if (hit) return hit;
    }
    return "";
  }
  const obj = node as Record<string, unknown>;
  const sym = String(obj.symbol ?? obj.ticker ?? obj.code ?? "").toUpperCase();
  if (sym === symbol) {
    const raw = String(obj.exchange ?? obj.floor ?? obj.market ?? obj.board ?? "").toUpperCase();
    if (raw.includes("HOSE") || raw === "HSX" || raw === "1") return "HOSE";
    if (raw.includes("HNX") || raw === "3") return "HNX";
    if (raw.includes("UPCOM") || raw.includes("UPC") || raw === "5") return "UPCOM";
    if (raw.includes("DERIV")) return "DERIVATIVE";
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const hit = findExchange(value, symbol);
      if (hit) return hit;
    }
  }
  return "";
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function GET(request: Request, ctx: Ctx) {
  return dispatch(request, ctx, "GET");
}
export async function POST(request: Request, ctx: Ctx) {
  return dispatch(request, ctx, "POST");
}
export async function PUT(request: Request, ctx: Ctx) {
  return dispatch(request, ctx, "PUT");
}

async function dispatch(request: Request, ctx: Ctx, method: string) {
  const { slug = [] } = await ctx.params;
  const path = slug.join("/");
  if (path === "internal-transfer" || path.startsWith("derivatives")) {
    return jsonResponse({ error: "Không hỗ trợ chuyển tiền nội bộ và phái sinh." }, request, { status: 404 });
  }

  if (method === "GET" && slug[0] === "ws-session" && slug[1]) {
    return redeemTicket(request, slug[1]);
  }

  const user = await usernameOf(request);
  if (user instanceof Response) return user;

  const tradingWrite =
    method !== "GET" &&
    (path === "connect" ||
      path === "disconnect" ||
      path === "refresh" ||
      path === "trading-mode" ||
      path === "orders" ||
      path.startsWith("orders/") ||
      path === "ws-ticket");
  if (user === "api-key" && tradingWrite) {
    return jsonResponse({ error: "API key cannot call TCBS trading routes" }, request, { status: 403 });
  }

  try {
    if (method === "POST" && path === "connect") return connect(request, user);
    if (method === "POST" && path === "refresh") return refreshToken(request, user);
    if (method === "GET" && path === "status") return status(request, user);
    if (method === "POST" && path === "disconnect") return disconnect(request, user);
    if (method === "POST" && path === "trading-mode") return tradingMode(request, user);
    if (method === "GET" && path === "audit") return audit(request, user);

    const sessionOr = await withSession(request, user);
    if (sessionOr instanceof Response) return sessionOr;
    const session = sessionOr;
    const q = new URL(request.url).searchParams;
    const accountNo = accountNoOf(request, session);

    if (method === "GET" && path === "accounts") {
      return callTcbs(user, session, request, () =>
        tcbsFetch(session.token, session.tokenExp, "GET", `/eros/v2/get-profile/by-username/${encodeURIComponent(session.custodyCode)}`, {
          query: { fields: q.get("fields") || "basicInfo,bankSubAccounts" },
        }),
      );
    }
    if (method === "GET" && path === "assets") {
      return callTcbs(user, session, request, () => tcbsFetch(session.token, session.tokenExp, "GET", `/aion/v1/accounts/${accountNo}/se`));
    }
    if (method === "GET" && path === "cash") {
      return callTcbs(user, session, request, () => tcbsFetch(session.token, session.tokenExp, "GET", `/aion/v1/accounts/${accountNo}/cashInvestments`));
    }
    if (method === "GET" && path === "statement") {
      return callTcbs(user, session, request, () =>
        tcbsFetch(session.token, session.tokenExp, "GET", "/erebos/v2/digital/trans-hist-cashStatements", {
          query: {
            accountno: accountNo,
            fromDate: q.get("fromDate") || "",
            toDate: q.get("toDate") || "",
            pageSize: q.get("pageSize") || "50",
            pageIndex: q.get("pageIndex") || "1",
            transactionCode: q.get("transactionCode") || "",
          },
        }),
      );
    }
    if (method === "GET" && path === "debt") {
      return callTcbs(user, session, request, () =>
        tcbsFetch(session.token, session.tokenExp, "GET", "/erebos/v2/digital/margin-info", {
          query: {
            acctno: accountNo,
            custodycd: session.custodyCode,
            fromdate: q.get("fromDate") || "2000-01-01",
            toDate: q.get("toDate") || new Date().toISOString().slice(0, 10),
            page: q.get("page") || "1",
            size: q.get("size") || "50",
          },
        }),
      );
    }
    if (method === "GET" && path === "margin/limits") {
      return callTcbs(user, session, request, () =>
        tcbsFetch(session.token, session.tokenExp, "GET", `/aion/v1/customers/${encodeURIComponent(session.custodyCode)}/accounts`),
      );
    }
    if (method === "GET" && path === "margin/risk") {
      return callTcbs(user, session, request, () => tcbsFetch(session.token, session.tokenExp, "GET", `/hydros/v1/account/${accountNo}/risk`));
    }
    if (method === "GET" && path === "margin/addons") {
      return callTcbs(user, session, request, () =>
        tcbsFetch(session.token, session.tokenExp, "GET", `/campaign-management/v1/margin/subscription/${accountNo}/addons/detail`),
      );
    }
    if (method === "GET" && path === "margin/loans") {
      return callTcbs(user, session, request, () => tcbsFetch(session.token, session.tokenExp, "GET", `/khaos/v1/loan/${accountNo}`));
    }
    if (method === "GET" && path === "margin/pricing") {
      return callTcbs(user, session, request, () =>
        tcbsFetch(session.token, session.tokenExp, "GET", `/hydros/v1/account/${accountNo}/pricing-policy`, {
          query: { productId: q.get("productId") },
        }),
      );
    }
    if (method === "GET" && path === "buying-power") {
      const symbol = (q.get("symbol") || "").toUpperCase();
      const price = q.get("price");
      let pathname = `/aion/v1/accounts/${accountNo}/ppse`;
      if (symbol && price) {
        const priced = Number(price) < 1000 ? Math.round(Number(price) * 1000) : Math.round(Number(price));
        pathname += `/${encodeURIComponent(symbol)}/${priced}`;
      } else if (symbol) pathname += `/${encodeURIComponent(symbol)}`;
      return callTcbs(user, session, request, () => tcbsFetch(session.token, session.tokenExp, "GET", pathname));
    }
    if (method === "GET" && path === "orders") {
      return callTcbs(user, session, request, () => tcbsFetch(session.token, session.tokenExp, "GET", `/aion/v1/accounts/${accountNo}/orders`));
    }
    if (method === "GET" && slug[0] === "orders" && slug[1] && slug.length === 2) {
      return callTcbs(user, session, request, () =>
        tcbsFetch(session.token, session.tokenExp, "GET", `/aion/v1/accounts/${accountNo}/orders/${encodeURIComponent(slug[1])}`),
      );
    }
    if (method === "GET" && path === "matches") {
      return callTcbs(user, session, request, () =>
        tcbsFetch(session.token, session.tokenExp, "GET", `/aion/v1/accounts/${accountNo}/matching-details`),
      );
    }
    if (method === "GET" && path === "market/quotes") {
      return callTcbs(user, session, request, () =>
        tcbsFetch(session.token, session.tokenExp, "GET", "/tartarus/v1/tickerCommons", {
          query: { tickers: q.get("tickers") || undefined, index: q.get("index") || undefined },
        }),
      );
    }
    if (method === "GET" && path === "market/foreign-room") {
      return callTcbs(user, session, request, () =>
        tcbsFetch(session.token, session.tokenExp, "GET", "/tartarus/v1/tickerSnaps", { query: { index: q.get("index") || "1" } }),
      );
    }
    if (method === "GET" && path === "market/put-through") {
      return callTcbs(user, session, request, () =>
        tcbsFetch(session.token, session.tokenExp, "GET", "/tartarus/v1/putThroughSnaps", { query: { floor: q.get("floor") || "1" } }),
      );
    }
    if (method === "GET" && path === "market/matches") {
      const ticker = (q.get("ticker") || "").toUpperCase();
      if (!ticker) return badRequestResponse("Thiếu ticker.", request);
      return callTcbs(user, session, request, () =>
        tcbsFetch(session.token, session.tokenExp, "GET", `/nyx/v1/intraday/${encodeURIComponent(ticker)}/his/paging`, {
          query: { page: q.get("page") || "0", size: q.get("size") || "100", headIndex: q.get("headIndex") || "-1" },
        }),
      );
    }
    if (method === "GET" && path === "market/supply-demand") {
      const ticker = (q.get("ticker") || "").toUpperCase();
      const window = q.get("window") || "15";
      if (!ticker) return badRequestResponse("Thiếu ticker.", request);
      if (window === "day") {
        return callTcbs(user, session, request, () =>
          tcbsFetch(session.token, session.tokenExp, "GET", `/nyx/v1/intraday/${encodeURIComponent(ticker)}/bsa`, {
            query: { type: q.get("type") || "all" },
          }),
        );
      }
      if (window === "month") {
        return callTcbs(user, session, request, () =>
          tcbsFetch(session.token, session.tokenExp, "GET", `/nyx/v1/intraday/${encodeURIComponent(ticker)}/bsa-month`, {
            query: { timeWindow: "1M", type: q.get("type") || "all" },
          }),
        );
      }
      return callTcbs(user, session, request, () =>
        tcbsFetch(session.token, session.tokenExp, "GET", `/nyx/v1/intraday/${encodeURIComponent(ticker)}/bsa-ext`, {
          query: { timeWindow: window, tWindow: window, type: q.get("type") || "all" },
        }),
      );
    }
    if (method === "GET" && path === "market/security") {
      const symbol = (q.get("symbol") || "").toUpperCase();
      if (!symbol) return badRequestResponse("Thiếu symbol.", request);
      return callTcbs(user, session, request, () =>
        tcbsFetch(session.token, session.tokenExp, "GET", "/ananke/v1/securities", {
          query: { fields: "all", filter: `symbol=${symbol}` },
        }),
      );
    }
    if (method === "POST" && path === "orders/preview") return previewOrder(request, user, session);
    if (method === "POST" && path === "orders") return placeOrder(request, user, session);
    if (method === "PUT" && slug[0] === "orders" && slug[1] && slug[2] === "cancel") return cancelOrder(request, user, session, slug[1]);
    if (method === "PUT" && slug[0] === "orders" && slug[1] && slug.length === 2) return amendOrder(request, user, session, slug[1]);
    if (method === "POST" && path === "ws-ticket") return issueTicket(request, user);

    return jsonResponse({ error: "Not found" }, request, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TCBS proxy failed";
    console.error("[/api/tcbs]", error);
    return serverErrorResponse(message, request);
  }
}

async function connect(request: Request, username: string) {
  const allowed = await allowRequest(`tcbs-connect:${clientIp(request)}`, 8, 15 * 60 * 1000).catch(() => true);
  if (!allowed) return jsonResponse({ error: "Too many connect attempts" }, request, { status: 429 });
  const body = await readBody(request);
  const apiKey = String(body.apiKey ?? "").trim();
  const otp = String(body.otp ?? "").trim();
  if (!apiKey || !otp) return badRequestResponse("Cần apiKey và otp.", request);
  if (!process.env.TCBS_ENC_KEY?.trim()) return serverErrorResponse("TCBS_ENC_KEY is not set", request);

  try {
    const token = await exchangeToken(apiKey, otp);
    const custodyCode = String(body.custodyCode ?? "").trim() || readJwtCustody(token);
    let accountNo = String(body.accountNo ?? "").trim();
    if (custodyCode) {
      const profile = await tcbsFetch(token, readJwtExp(token), "GET", `/eros/v2/get-profile/by-username/${encodeURIComponent(custodyCode)}`, {
        query: { fields: "basicInfo,bankSubAccounts" },
      });
      if (!accountNo) accountNo = pickEquityAccount(profile);
    }
    await saveConnected({
      username,
      apiKey,
      token,
      tokenExp: readJwtExp(token),
      custodyCode,
      accountNo,
    });
    return jsonResponse({ connected: true, custodyCode, accountNo, readOnly: true }, request);
  } catch (error) {
    if (error instanceof TcbsReauth) return reauth(request);
    const message = error instanceof Error ? error.message : "Connect failed";
    return badRequestResponse(message, request);
  }
}

async function status(request: Request, username: string) {
  const session = await loadSession(username);
  if (!session) return jsonResponse({ connected: false, readOnly: true, needsReauth: false }, request);
  return jsonResponse(
    {
      connected: !session.needsReauth && Boolean(session.token),
      needsReauth: session.needsReauth,
      readOnly: session.readOnly,
      custodyCode: session.custodyCode,
      accountNo: session.accountNo,
    },
    request,
  );
}

async function refreshToken(request: Request, username: string) {
  const session = await loadSession(username);
  if (session && !session.needsReauth && session.token && session.tokenExp && session.tokenExp.getTime() > Date.now() + 60_000) {
    return jsonResponse({ connected: true, refreshed: false, custodyCode: session.custodyCode, accountNo: session.accountNo, readOnly: session.readOnly }, request);
  }
  const apiKey = await loadApiKey(username);
  if (!apiKey) return reauth(request);
  const body = await readBody(request);
  const otp = String(body.otp ?? "").trim();
  if (!otp) {
    return badRequestResponse("TCBS yêu cầu iOTP mới. Gửi { otp } — API key đã lưu mã hoá trên server.", request);
  }
  try {
    const token = await exchangeToken(apiKey, otp);
    await rotateToken(username, token, readJwtExp(token));
    return jsonResponse({ connected: true, refreshed: true }, request);
  } catch (error) {
    if (error instanceof TcbsReauth) return reauth(request);
    const message = error instanceof Error ? error.message : "Refresh failed";
    return badRequestResponse(message, request);
  }
}

async function disconnect(request: Request, username: string) {
  await deleteTcbsSession(username);
  return jsonResponse({ connected: false }, request);
}

async function tradingMode(request: Request, username: string) {
  const session = await loadSession(username);
  if (!session) return reauth(request);
  const body = await readBody(request);
  const readOnly = Boolean(body.readOnly);
  const extras = pushAudit(session.extras, "trading-mode", readOnly ? "read-only" : "trading");
  await updateSession(username, { readOnly, extras });
  return jsonResponse({ readOnly }, request);
}

async function audit(request: Request, username: string) {
  const session = await loadSession(username);
  return jsonResponse({ audit: session?.extras.audit ?? [] }, request);
}

async function resolveExchange(session: TcbsSessionView, order: EquityOrder): Promise<string> {
  if (order.exchange) return order.exchange;
  const info = await tcbsFetch(session.token, session.tokenExp, "GET", "/ananke/v1/securities", {
    query: { fields: "all", filter: `symbol=${order.symbol}` },
  });
  return findExchange(info, order.symbol);
}

async function previewOrder(request: Request, username: string, session: TcbsSessionView) {
  const body = await readBody(request);
  const checked = validateEquityOrder({ ...body, accountNo: body.accountNo || session.accountNo });
  if (!checked.ok) return badRequestResponse(checked.error, request);
  let exchange = checked.order.exchange;
  try {
    exchange = await resolveExchange(session, checked.order);
  } catch (error) {
    if (error instanceof TcbsReauth) {
      await markReauth(username);
      return reauth(request);
    }
  }
  if (!exchange || exchange === "DERIVATIVE") return badRequestResponse("Chỉ đặt lệnh sàn HOSE, HNX hoặc UPCOM.", request);
  const order = { ...checked.order, exchange };
  const confirmToken = randomId();
  const confirms = { ...(session.extras.confirms ?? {}) };
  const now = Date.now();
  for (const [key, value] of Object.entries(confirms)) {
    if (value.exp < now) delete confirms[key];
  }
  confirms[confirmToken] = { hash: orderHash(order), exp: now + 2 * 60 * 1000, order };
  await updateSession(username, { extras: { ...session.extras, confirms } });
  return jsonResponse({ confirmToken, expiresInSec: 120, order, cost: estimateCost(order), readOnly: session.readOnly }, request);
}

async function placeOrder(request: Request, username: string, session: TcbsSessionView) {
  if (session.readOnly) return jsonResponse({ error: "READ_ONLY", message: "Đang ở chế độ chỉ đọc." }, request, { status: 403 });
  const idem = request.headers.get("idempotency-key")?.trim();
  if (!idem) return badRequestResponse("Thiếu header Idempotency-Key.", request);
  const claim = await claimIdempotency(username, idem);
  if (claim.status === "replay") return jsonResponse(claim.body, request);
  if (claim.status === "pending") return jsonResponse({ error: "IDEMPOTENT_IN_PROGRESS" }, request, { status: 409 });

  const body = await readBody(request);
  const confirmToken = String(body.confirmToken ?? "");
  const pending = session.extras.confirms?.[confirmToken];
  if (!pending || pending.exp < Date.now()) {
    await releaseIdempotency(username, idem);
    return badRequestResponse("confirmToken hết hạn. Xem lại lệnh trước khi gửi.", request);
  }
  const checked = validateEquityOrder({ ...body, accountNo: pending.order.accountNo, exchange: pending.order.exchange });
  if (!checked.ok) {
    await releaseIdempotency(username, idem);
    return badRequestResponse(checked.error, request);
  }
  if (orderHash(checked.order) !== pending.hash) {
    await releaseIdempotency(username, idem);
    return badRequestResponse("Lệnh đã đổi so với bản xác nhận.", request);
  }

  const confirms = { ...session.extras.confirms };
  delete confirms[confirmToken];
  try {
    const result = await tcbsFetch(session.token, session.tokenExp, "POST", `/akhlys/v1/accounts/${pending.order.accountNo}/orders`, {
      body: {
        execType: pending.order.execType,
        symbol: pending.order.symbol,
        priceType: pending.order.priceType,
        price: pending.order.priceVnd,
        quantity: pending.order.quantity,
      },
    });
    const extras = pushAudit({ ...session.extras, confirms }, "place", `${pending.order.execType} ${pending.order.symbol} ${pending.order.quantity}@${pending.order.priceVnd}`);
    await updateSession(username, { extras });
    await completeIdempotency(username, idem, result);
    return jsonResponse(result, request);
  } catch (error) {
    await releaseIdempotency(username, idem);
    if (error instanceof TcbsReauth) {
      await markReauth(username);
      return reauth(request);
    }
    const message = error instanceof Error ? error.message : "Đặt lệnh thất bại";
    return serverErrorResponse(message, request);
  }
}

async function amendOrder(request: Request, username: string, session: TcbsSessionView, orderId: string) {
  if (session.readOnly) return jsonResponse({ error: "READ_ONLY", message: "Đang ở chế độ chỉ đọc." }, request, { status: 403 });
  const body = await readBody(request);
  if (!body.confirmToken) return badRequestResponse("Cần confirmToken.", request);
  const pending = session.extras.confirms?.[String(body.confirmToken)];
  if (!pending || pending.exp < Date.now()) return badRequestResponse("confirmToken hết hạn.", request);
  const priceVnd = pending.order.priceVnd;
  const quantity = pending.order.quantity;
  try {
    const result = await tcbsFetch(session.token, session.tokenExp, "PUT", `/akhlys/v1/accounts/${pending.order.accountNo}/orders/${encodeURIComponent(orderId)}`, {
      body: { price: priceVnd, quantity },
    });
    const confirms = { ...session.extras.confirms };
    delete confirms[String(body.confirmToken)];
    await updateSession(username, { extras: pushAudit({ ...session.extras, confirms }, "amend", orderId) });
    return jsonResponse(result, request);
  } catch (error) {
    if (error instanceof TcbsReauth) {
      await markReauth(username);
      return reauth(request);
    }
    const message = error instanceof Error ? error.message : "Sửa lệnh thất bại";
    return serverErrorResponse(message, request);
  }
}

async function cancelOrder(request: Request, username: string, session: TcbsSessionView, orderId: string) {
  if (session.readOnly) return jsonResponse({ error: "READ_ONLY", message: "Đang ở chế độ chỉ đọc." }, request, { status: 403 });
  const body = await readBody(request);
  if (String(body.confirmToken ?? "") !== `cancel:${orderId}`) {
    return jsonResponse({ confirmToken: `cancel:${orderId}`, orderId, message: "Gửi lại với confirmToken để huỷ." }, request);
  }
  const accountNo = String(body.accountNo ?? session.accountNo);
  try {
    const result = await tcbsFetch(session.token, session.tokenExp, "PUT", `/akhlys/v1/accounts/${accountNo}/cancel-orders`, {
      body: { ordersList: [orderId] },
    });
    await updateSession(username, { extras: pushAudit(session.extras, "cancel", orderId) });
    return jsonResponse(result, request);
  } catch (error) {
    if (error instanceof TcbsReauth) {
      await markReauth(username);
      return reauth(request);
    }
    const message = error instanceof Error ? error.message : "Huỷ lệnh thất bại";
    return serverErrorResponse(message, request);
  }
}

async function issueTicket(request: Request, username: string) {
  const body = await readBody(request);
  const stream = String(body.stream ?? "normal");
  if (!wsUpstream(stream)) return badRequestResponse("stream phải là normal, orders hoặc flow.", request);
  const symbol = String(body.symbol ?? "").trim().toUpperCase();
  const issued = await issueWsTicket(username, stream, symbol);
  return jsonResponse(
    {
      ticket: issued.ticket,
      stream,
      symbol,
      expiresInSec: issued.expiresInSec,
      relayUrl: process.env.TCBS_RELAY_URL || "",
    },
    request,
  );
}

async function redeemTicket(request: Request, ticket: string) {
  const secret = process.env.TCBS_RELAY_SECRET?.trim();
  const presented = request.headers.get("x-relay-secret")?.trim() ?? "";
  if (!secret || !presented || !secretsEqual(presented, secret)) return unauthorizedResponse(request);
  const row = await redeemWsTicket(ticket);
  if (!row) return jsonResponse({ error: "ticket expired" }, request, { status: 404 });
  const session = await loadSession(row.username);
  if (!session?.token) return jsonResponse({ error: "ticket expired" }, request, { status: 404 });
  const url = wsUpstream(row.stream);
  return jsonResponse({ url, token: session.token, symbol: row.symbol, stream: row.stream }, request);
}
