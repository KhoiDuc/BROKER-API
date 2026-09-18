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
