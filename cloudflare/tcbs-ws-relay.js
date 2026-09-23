/**
 * Cloudflare Worker. Browser opens wss://relay/?ticket=...
 * The worker redeems the single-use ticket on broker-api, then bridges to TCBS.
 *
 * wrangler secrets: BROKER_API_URL, TCBS_RELAY_SECRET
 */
const relay = {
  async fetch(request, env) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("TCBS websocket relay", { status: 426 });
    }
    const ticket = new URL(request.url).searchParams.get("ticket");
    if (!ticket) return new Response("missing ticket", { status: 400 });

    const api = String(env.BROKER_API_URL || "").replace(/\/$/, "");
    const secret = String(env.TCBS_RELAY_SECRET || "");
    if (!api || !secret) return new Response("relay is not configured", { status: 500 });

    const redeemed = await fetch(`${api}/api/tcbs/ws-session/${encodeURIComponent(ticket)}`, {
      headers: { "x-relay-secret": secret },
    });
    if (!redeemed.ok) return new Response("ticket rejected", { status: 401 });
    const session = await redeemed.json();
    if (!session.url || !session.token) return new Response("ticket rejected", { status: 401 });

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const upstreamUrl = new URL(session.url);
    if (!upstreamUrl.searchParams.has("token")) upstreamUrl.searchParams.set("token", session.token);
    const upstream = new WebSocket(upstreamUrl.toString());

    const closeBoth = (code = 1000) => {
      try { server.close(code); } catch { /* already closed */ }
      try { upstream.close(code); } catch { /* already closed */ }
    };

    upstream.addEventListener("open", () => {
      upstream.send(JSON.stringify({ token: session.token, symbol: session.symbol || "", stream: session.stream || "" }));
    });
    upstream.addEventListener("message", (event) => server.send(event.data));
    server.addEventListener("message", (event) => {
      if (upstream.readyState === WebSocket.OPEN) upstream.send(event.data);
    });
    upstream.addEventListener("close", () => closeBoth());
    server.addEventListener("close", () => closeBoth());
    upstream.addEventListener("error", () => closeBoth(1011));

    return new Response(null, { status: 101, webSocket: client });
  },
};

export default relay;
