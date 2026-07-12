# Deploying Tradynance

The whole stack ships as Docker images and a compose file. This is the fastest path to a running
deployment; read the **security & custody notes** before going anywhere near real funds.

## What runs
- **web** — the Next.js app (standalone production server, port 3000).
- **market-data** — polls live tickers into the DB.
- **market-maker** — seeds order-book liquidity (demo; disable for a real venue).
- **liquidation-engine** — marks + liquidates futures positions, accrues funding.
- **sweeper** — consolidates deposits into the treasury/hot wallet.
- **chain-watcher** — detects on-chain deposits and credits them.
- **postgres** (data) + **redis** (available for future rate-limit/cache) + a one-shot **migrate**
  job that applies migrations and seeds before anything else starts.

## Quick start (Docker Compose)
```bash
cp .env.docker.example .env       # then fill it in (see below)
docker compose up --build -d      # migrate runs first, then web + services
docker compose logs -f web
curl -f http://localhost:3000/api/health   # {"status":"ok","db":"up"}
```
Put a TLS-terminating reverse proxy (Caddy / nginx / Traefik) in front of `web:3000` for HTTPS.

## Environment (the parts that matter)
- **`BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` must EXACTLY match the public origin** (scheme +
  host + port) the browser loads — e.g. `https://app.example.com`. The auth client calls this
  origin from the browser, and the app's `Content-Security-Policy: connect-src 'self'` will **block
  a mismatch** (you'll see "Refused to connect" and login will fail). This is the #1 deploy gotcha.
- **`DATABASE_URL`** points at the compose service host `postgres` (not `localhost`), and its
  user/password must match the `POSTGRES_*` values.
- **`BETTER_AUTH_SECRET`** — generate with `openssl rand -base64 32`.
- **Custody:** `HD_WALLET_MNEMONIC` is the hot wallet. In this repo it's testnet/dev only — in
  production it must come from a **secrets manager**, never a committed file or plain env. The
  treasury derives on account `TREASURY_ACCOUNT_INDEX` (default 1), separate from user deposit
  addresses; the hot wallet must be **funded** for on-chain withdrawals/sweeps to succeed.
- Optional: `RESEND_API_KEY` (email), `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` (monitoring),
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

## Without Docker
```bash
npm ci
npx prisma migrate deploy --schema web/prisma/schema.prisma
npm run db:seed
npm run build --workspace web
# run the standalone server:
node web/.next/standalone/web/server.js     # after copying .next/static + public in (Docker does this)
# and each service: npx tsx services/<name>/src/index.ts
```
