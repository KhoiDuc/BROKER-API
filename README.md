# broker-api

Next.js API for broker portfolio (stock recommendations). Postgres on Supabase, deploy on Vercel.

## Setup

1. Copy `.env.example` to `.env.local` and fill in Supabase + auth:

```powershell
copy .env.example .env.local
```

- `DATABASE_URL` — Supabase pooler (port **6543**)
- `DIRECT_URL` — Supabase direct (port **5432**) for migrations
- `TRADING_USERNAME` — login username for Blazor Broker desk
- `TRADING_PASSWORD_HASH` — bcrypt hash (see below)
- `JWT_SECRET` — secret for signing JWT access tokens
- `JWT_EXPIRES_IN` — token lifetime (default `7d`)
- `API_KEY` — optional server-side Bearer (curl/seed only; not used by Blazor)
- `ALLOWED_ORIGINS` — Blazor origins for CORS (comma-separated)

Generate password hash:

```powershell
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
```

2. Install and migrate:

```powershell
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

3. Run locally:

```powershell
npm run dev
```

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | `{ username, password }` → JWT |
| GET | `/api/auth/me` | Bearer JWT | Current user |
| GET | `/api/portfolio` | Bearer JWT or `API_KEY` | Full portfolio JSON |
| PUT | `/api/portfolio` | Bearer JWT or `API_KEY` | Replace portfolio (import) |
| GET | `/api/positions/{symbol}` | Bearer JWT or `API_KEY` | Single position |
| POST | `/api/positions` | Bearer JWT or `API_KEY` | Create position |
| PUT | `/api/positions/{symbol}` | Bearer JWT or `API_KEY` | Update position metadata |
| PATCH | `/api/positions/{symbol}/archive` | Bearer JWT or `API_KEY` | `{ isArchived, status? }` archive/reopen |
| DELETE | `/api/positions/{symbol}` | Bearer JWT or `API_KEY` | Delete position |
| POST/PUT/DELETE | `/api/positions/{symbol}/lots/...` | Bearer JWT or `API_KEY` | Buy lot CRUD |
| POST/PUT/DELETE | `/api/positions/{symbol}/sells/...` | Bearer JWT or `API_KEY` | Sell CRUD |
| POST/PUT/DELETE | `/api/positions/{symbol}/notes/...` | Bearer JWT or `API_KEY` | Note CRUD |
| POST/PUT/DELETE | `/api/positions/{symbol}/dividends/...` | Bearer JWT or `API_KEY` | Dividend CRUD |
| OPTIONS | `*` | No | CORS preflight |
| GET | `/api/health` | No | Database ping |
| GET | `/api/portfolio/export` | Bearer JWT or read-only `API_KEY` | CSV download |
| POST | `/api/portfolio/import?dryRun=true` | Bearer JWT or `API_KEY` | CSV diff preview (does not write) |
| GET/POST | `/api/portfolio/snapshots` | Bearer JWT or `API_KEY` | NAV history / record a snapshot |
| GET/POST | `/api/alerts` | Bearer JWT or `API_KEY` | Price alerts |
| DELETE | `/api/alerts/{id}` | Bearer JWT or `API_KEY` | Remove an alert |
| POST | `/api/ai/chat` | Bearer JWT or `API_KEY` | Gemini proxy (`GEMINI_API_KEY` stays on the server) |
| POST | `/api/tcbs/connect` | Bearer JWT | Exchange TCBS API key + OTP. Rate limited. `API_KEY` is rejected. |
| POST | `/api/tcbs/refresh` | Bearer JWT | New OTP only; the encrypted API key is reused. TCBS does not issue a silent refresh. |
| GET | `/api/tcbs/status` | Bearer JWT or `API_KEY` | Connection status |
| POST | `/api/tcbs/orders/preview` | Bearer JWT | Confirm token for an equity order |
| POST | `/api/tcbs/orders` | Bearer JWT | Place order. Requires `Idempotency-Key`. `API_KEY` is rejected. |
| PUT | `/api/tcbs/orders/{id}` | Bearer JWT | Amend. `API_KEY` is rejected. |
| PUT | `/api/tcbs/orders/{id}/cancel` | Bearer JWT | Cancel. `API_KEY` is rejected. |
| POST | `/api/tcbs/ws-ticket` | Bearer JWT | Single-use websocket ticket |
| GET | `/api/tcbs/ws-session/{ticket}` | `x-relay-secret` | Redeem ticket once. Returns the upstream URL and token. |
| GET | `/api/tcbs/audit` | Bearer JWT or `API_KEY` | Recent trading actions |
| GET | `/api/cron/snapshots` | `CRON_SECRET` | Daily NAV snapshot |
| GET | `/api/cron/alerts` | `CRON_SECRET` | Fire Discord/Telegram alerts |

`API_KEY` is read for portfolio data and rejected on TCBS trading routes (`connect`, `refresh`, orders, `ws-ticket`, `trading-mode`, `disconnect`).

Child lot/sell/note/dividend updates match both the id and the position symbol. A mismatched id returns 404.

Portfolio import deletes and recreates rows inside one interactive transaction.

### Duplicate migration

`prisma/migrations/0_init` duplicated `20250914100000_init` and has been removed. If production already recorded `0_init`, mark it rolled back without dropping tables, then mark the timestamped init as applied if it is not already:

```powershell
npx prisma migrate resolve --rolled-back 0_init
npx prisma migrate resolve --applied 20250914100000_init
npx prisma migrate deploy
```

Set `ALLOWED_ORIGINS` on Vercel to the GitHub Pages origin (for example `https://khoinguyenminhduc.github.io`) plus localhost. The websocket relay lives in `cloudflare/tcbs-ws-relay.js`.

All mutation responses return mapped JSON DTOs (numbers as numbers, not Prisma Decimal strings).

### Test

```powershell
# Login
curl -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"username\":\"trader\",\"password\":\"your-password\"}'

# Portfolio (use token from login)
curl http://localhost:3000/api/portfolio `
  -H "Authorization: Bearer YOUR_JWT"

# Archive position
curl -X PATCH http://localhost:3000/api/positions/VNM/archive `
  -H "Authorization: Bearer YOUR_JWT" `
  -H "Content-Type: application/json" `
  -d '{\"isArchived\":true,\"status\":\"DaDong\"}'

# Seed via API key (server-side only)
curl -X PUT http://localhost:3000/api/portfolio `
  -H "Authorization: Bearer YOUR_API_KEY" `
  -H "Content-Type: application/json" `
  -d "@seed/portfolio.json"
```

## Deploy (Vercel)

1. Push repo to GitHub
2. Import project in Vercel
3. Set env vars: `DATABASE_URL`, `DIRECT_URL`, `TRADING_USERNAME`, `TRADING_PASSWORD_HASH`, `JWT_SECRET`, `ALLOWED_ORIGINS` (and optionally `API_KEY`)
4. Build command: `npx prisma generate && npm run build`
5. After deploy, run migration against production DB:

```powershell
npx prisma migrate deploy
npm run db:seed
```

## Blazor integration

In `BlazorWasmPortfolioGhAction/wwwroot/appsettings.json`:

```json
"BrokerApi": {
  "BaseUrl": "https://your-app.vercel.app"
}
```

Users sign in at `/trading/login`. The Blazor app stores the JWT and sends it as `Authorization: Bearer <token>` on all Broker API calls. Do **not** put `API_KEY` in the frontend.
