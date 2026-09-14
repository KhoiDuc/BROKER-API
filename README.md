# broker-api

Next.js API for broker portfolio (stock recommendations). Postgres on Supabase, deploy on Vercel.

## Setup

1. Copy `.env.example` to `.env.local` and fill in Supabase + API key:

```powershell
copy .env.example .env.local
```

- `DATABASE_URL` — Supabase pooler (port **6543**)
- `DIRECT_URL` — Supabase direct (port **5432**) for migrations
- `API_KEY` — Bearer token for `PUT /api/portfolio`
- `ALLOWED_ORIGIN` — Blazor GitHub Pages URL (CORS)

2. Install and migrate:

```powershell
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```

3. Run locally:

```powershell
npm run dev
```

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/portfolio` | No | Full portfolio JSON |
| PUT | `/api/portfolio` | Bearer `API_KEY` | Replace portfolio |
| OPTIONS | `/api/portfolio` | No | CORS preflight |

### Test

```powershell
curl http://localhost:3000/api/portfolio

curl -X PUT http://localhost:3000/api/portfolio `
  -H "Authorization: Bearer YOUR_API_KEY" `
  -H "Content-Type: application/json" `
  -d "@seed/portfolio.json"
```

## Deploy (Vercel)

1. Push repo to GitHub
2. Import project in Vercel
3. Set env vars: `DATABASE_URL`, `DIRECT_URL`, `API_KEY`, `ALLOWED_ORIGIN`
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
  "BaseUrl": "https://your-app.vercel.app",
  "ApiKey": "same-as-API_KEY"
}
```
