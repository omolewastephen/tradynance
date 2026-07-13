# Deploying Tradynance

Two supported paths: **Docker Compose** (fastest, below) or **bare Node + PM2**
(["Deploy without Docker"](#deploy-without-docker-bare-node--pm2)) — Tradynance is a plain Node app,
Docker is optional. Read the **security & custody notes** before going anywhere near real funds.

## What runs
- **web** — the Next.js app (standalone production server, port 3000).
- **market-data** — polls live tickers into the DB.
- **market-maker** — seeds order-book liquidity (demo; disable for a real venue).
- **liquidation-engine** — marks + liquidates futures positions, accrues funding.
- **sweeper** — consolidates deposits into the treasury/hot wallet.
- **chain-watcher** — detects on-chain deposits and credits them.
- **postgres** (data) + **redis** (shared rate limiting across web replicas; optional — unset
  `REDIS_URL` for single-node in-process limiting) + a one-shot **migrate**
  job that applies migrations and seeds before anything else starts.

## Quick start (Docker Compose)
```bash
cp .env.docker.example .env       # then fill it in (see below)
docker compose up --build -d      # migrate runs first, then web + services
docker compose logs -f web
curl -f http://localhost:3000/api/health   # {"status":"ok","db":"up"}
```
Put a TLS-terminating reverse proxy (Caddy / nginx / Traefik) in front of `web:3000` for HTTPS.

## Managed platforms

Both run always-on processes (unlike Vercel/Netlify, which can't host the background services).

### Render (one-file blueprint — `render.yaml`)
`render.yaml` provisions **everything**: Postgres 16, Redis, the web service, and the five worker
services (market-data, market-maker, liquidation-engine, sweeper, chain-watcher).
1. Render → **New → Blueprint** → pick this repo. It reads `render.yaml`.
2. Fill the prompted secrets (`sync: false`): `HD_WALLET_MNEMONIC`, and — **critically** —
   `NEXT_PUBLIC_APP_URL` + `BETTER_AUTH_URL` = the web service's final origin (its `onrender.com`
   URL or your custom domain, with `https://`). A mismatch here breaks login (CSP).
3. First deploy runs migrations (`preDeployCommand`). Then open a **Shell** on `tradynance-web`
   and run `npm run db:seed` **once** (creates `admin@tradynance.local / ChangeMe123!` + the
   asset/market catalog — change the password). Web + workers need paid plans to stay always-on.

### Railway (`railway.json` + a few dashboard steps)
Railway is per-service, so the web service uses `railway.json` (build + migrate-on-start +
`/api/health`) and you add the workers alongside it:
1. **New Project → Deploy from repo.** The first service picks up `railway.json` → that's **web**.
2. Add plugins: **PostgreSQL** and **Redis**.
3. On **web**, set variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`,
   `REDIS_URL=${{Redis.REDIS_URL}}`, `BETTER_AUTH_SECRET` (generate), and
   `NEXT_PUBLIC_APP_URL` + `BETTER_AUTH_URL` = the web service's public domain. Add the rest from
   `.env.docker.example`. Enable a public domain for web.
4. Add **5 more services** from the same repo (one per worker). For each, in Settings set:
   - **Build:** `npm ci --include=dev && npx prisma generate --schema web/prisma/schema.prisma`
   - **Start:** `npx tsx services/<name>/src/index.ts`  (market-data / market-maker /
     liquidation-engine / sweeper / chain-watcher)
   - Share the same variables (`DATABASE_URL`, `HD_WALLET_MNEMONIC`, RPC URLs, …) — a shared
     variable group is easiest.
5. Run `npm run db:seed` **once** (Railway shell) after the first successful web deploy.

### Netlify (web) + Supabase (DB) + Zoho (email)
This is a **split** deploy: Netlify hosts the web app, but **Netlify is serverless and cannot run
the 5 background services** (same limitation as Vercel). So:

```
┌── Netlify ─────────────┐   ┌── Supabase ──┐   ┌── Upstash ─┐   ┌── one small always-on host ─┐
│  Next.js web app       │──▶│  Postgres    │◀──│  Redis     │◀──│  market-data, market-maker, │
│  (serverless functions)│   │  (+ pooler)  │   │            │   │  liquidation, sweeper,      │
└────────────────────────┘   └──────────────┘   └────────────┘   │  chain-watcher (PM2/Docker) │
                                    ▲───────────────────────────── └─────────────────────────────┘
```

**1. Supabase (Postgres).** New project → **Project Settings → Database → Connection string**:
- **`DATABASE_URL`** = the **Transaction pooler** URI (host `...pooler.supabase.com`, port **6543**).
  Append **`?pgbouncer=true&connection_limit=1`** — serverless functions each open a connection, so
  the pooler + `connection_limit=1` prevents exhausting Postgres.
- **`DIRECT_URL`** = the **Direct connection** URI (port **5432**). Prisma uses it for migrations
  (the pooler can't run DDL). Both are required — the schema declares `directUrl`.
- Run migrations from your machine once: `cd web && DATABASE_URL=<direct> DIRECT_URL=<direct> npx
  prisma migrate deploy && npm run db:seed` (use the **direct** URL for both here).

**2. Upstash (Redis)** — serverless Redis for the rate limiter (Netlify functions are isolated, so
in-process limiting doesn't hold). Create a database → copy the `redis://…` URL → set as
**`REDIS_URL`** on the Netlify site (and on the workers host). Free tier is plenty to start.

**3. Netlify (web).** New site from the repo. `netlify.toml` (repo root) sets the build command,
`publish = web/.next`, Node 20, and forces `NETLIFY=true` (which disables `output:standalone` so
Netlify's Next runtime bundles the app). Leave **Base directory empty** (build runs from the repo
root so npm workspaces installs `packages/core`). Set env vars: `DATABASE_URL` (pooled),
`DIRECT_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, and — **critical** — `NEXT_PUBLIC_APP_URL` +
`BETTER_AUTH_URL` = your final Netlify URL / custom domain (see the CSP gotcha below). Deploy.

**4. Zoho (email).** Set on **both** the Netlify site and the workers host:
`SMTP_HOST=smtp.zoho.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=you@yourdomain.com`,
`SMTP_PASS=`*app-specific password* (Zoho → **My Account → Security → App Passwords**; required when
2FA is on), `EMAIL_FROM="Tradynance <you@yourdomain.com>"`. The From domain must be verified in
Zoho. Send yourself a password-reset to confirm delivery before relying on it.

**5. The 5 workers.** They must run somewhere always-on — the cheapest is a **$5 VPS** (or a tiny
Railway/Render/Fly service) running just the services against the same Supabase + Upstash. Use the
[bare-Node + PM2 path](#deploy-without-docker-bare-node--pm2) but start **only the services** (skip
`web`): `pm2 start ecosystem.config.cjs --only market-data,market-maker,liquidation-engine,sweeper,chain-watcher`.
Give that host the same `DATABASE_URL`/`DIRECT_URL` (direct connection is fine there — they're
long-lived), `REDIS_URL`, `HD_WALLET_MNEMONIC`, and RPC URLs. Without at least `market-data`, prices
won't update on the site. **You can launch web-only first** and add the workers when you need live
prices / futures liquidation / on-chain deposits.

> Migrations don't run automatically on Netlify (no release phase), so always `prisma migrate
> deploy` yourself (step 1) before/after a deploy that changes the schema.

## Environment (the parts that matter)
- **`BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` must EXACTLY match the public origin** (scheme +
  host + port) the browser loads — e.g. `https://app.example.com`. The auth client calls this
  origin from the browser, and the app's `Content-Security-Policy: connect-src 'self'` will **block
  a mismatch** (you'll see "Refused to connect" and login will fail). This is the #1 deploy gotcha.
- **`DATABASE_URL`** points at the compose service host `postgres` (not `localhost`), and its
  user/password must match the `POSTGRES_*` values. **`DIRECT_URL`** (Prisma migrate/generate) is
  the same value everywhere *except Supabase*, where `DATABASE_URL` is the pooled URL (6543) and
  `DIRECT_URL` is the direct URL (5432).
- **`BETTER_AUTH_SECRET`** — generate with `openssl rand -base64 32`.
- **Custody:** `HD_WALLET_MNEMONIC` is the hot wallet. In this repo it's testnet/dev only — in
  production it must come from a **secrets manager**, never a committed file or plain env. The
  treasury derives on account `TREASURY_ACCOUNT_INDEX` (default 1), separate from user deposit
  addresses; the hot wallet must be **funded** for on-chain withdrawals/sweeps to succeed.
- **Email** (optional, degrades to console logging when unset): set **either** SMTP
  (`SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE`/`SMTP_USER`/`SMTP_PASS` — e.g. Zoho, see above) **or**
  `RESEND_API_KEY`. SMTP wins if both are set. `EMAIL_FROM` must be a verified sender either way.
- Optional: `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` (monitoring),
  `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (WalletConnect). All degrade gracefully when unset.

## First boot
The `migrate` job seeds an admin: **admin@tradynance.local / ChangeMe123!** — **change this
password immediately** and rotate `BETTER_AUTH_SECRET`. It also seeds the asset catalog, markets,
staking/launchpad/NFT demo data and blog posts; prune what you don't want from the admin panel.

## Security posture (shipped)
- Security headers on every response: CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy` (see `web/next.config.ts`).
- Rate limiting on auth + sensitive actions; append-only audit log; 2FA + anti-phishing.
- **Follow-ups before heavy production use:** a nonce-based strict CSP (drop `'unsafe-inline'`/
  `'unsafe-eval'`), secrets from a vault, and — for **multiple web replicas** — move rate limiting +
  better-auth rate-limit storage to **Redis** (they're in-process today, so run a single web
  replica or add the shared store first). `REDIS_URL` is already provided for this.

## Compliance
KYC/AML, money-transmitter licensing, and custody obligations are the **operator's
responsibility** — this repo does not make you compliant. Flagged, not solved, in code.

## Deploy without Docker (bare Node + PM2)

Docker is optional — Tradynance is a plain Node app. On a host with **Node 20**, **PostgreSQL 16**,
and (optionally) **Redis**, use the process manager [PM2](https://pm2.keymetrics.io/).

```bash
# 1. Postgres + Redis on the host (or managed services). Create the DB + user.
#    (Ubuntu: apt install postgresql redis-server, then createdb/createuser)

# 2. Code + deps
git clone <repo> && cd tradynance
npm ci
cp .env.docker.example .env      # fill it in — DATABASE_URL points at your Postgres host,
                                 # and BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL = your real origin

# 3. Database
npm run db:migrate               # prisma migrate deploy
npm run db:seed                  # admin@tradynance.local / ChangeMe123!  (change it)

# 4. Build the standalone server (+ copies static/public into it)
npm run build

# 5. Run everything with PM2 (web + all 5 services), from the repo root
npm i -g pm2
pm2 start ecosystem.config.cjs   # reads .env; defines web + market-data + market-maker
                                 #   + liquidation-engine + sweeper + chain-watcher
pm2 save && pm2 startup          # survive reboots
pm2 logs                         # tail everything
curl -f http://localhost:3000/api/health
```
Then front `localhost:3000` with **nginx / Caddy** for TLS (same as the Docker path — HSTS only
kicks in over HTTPS, and `BETTER_AUTH_URL`/`NEXT_PUBLIC_APP_URL` must equal that HTTPS origin).

To run just the web server without PM2: `npm run start:web`
(= `node web/.next/standalone/web/server.js`). Each service alone: `npx tsx services/<name>/src/index.ts`.

**systemd** is a fine alternative to PM2 — one unit per process running the same commands
(`ExecStart=/usr/bin/node .../server.js` for web, `ExecStart=.../node_modules/.bin/tsx services/<name>/src/index.ts`
for services), with `EnvironmentFile=/path/to/.env`.
