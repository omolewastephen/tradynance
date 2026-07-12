# CLAUDE.md — Tradynance

Read this fully before any task. It is the source of truth for conventions and state.
This file governs `tradynance/` and overrides the unrelated ISRMS CLAUDE.md at the Desktop root.

## Project
**Tradynance** — a premium fintech cryptocurrency trading platform (spot/margin/futures,
wallets, admin panel, ML-free) comparable in feel to Binance/Bybit/OKX/Coinbase Advanced.
Real deposit addresses + real blockchain withdrawals are in scope (custodial model), plus
WalletConnect for users paying from their own wallet. **Compliance/licensing (KYC/AML,
money-transmitter status) is the user's responsibility, not something this repo solves in
code.** Flag anything that touches regulated territory rather than assuming it away.

## Locked stack — do NOT change without being asked
- **Next.js 15.5 full-stack** (App Router). Route handlers + server actions are the backend
  for everything request/response-shaped: auth, dashboard, admin, wallet ledger CRUD, KYC,
  settings, CMS, reports.
- React 19, TypeScript (strict), TailwindCSS 4, shadcn/ui, React Query, React Hook Form, Zod 4.
- **Prisma 6 — NOT 7.** In-schema `datasource { url = env(...) }`. Do not upgrade to v7 syntax.
- PostgreSQL 16. Redis (cache, pub/sub, BullMQ queues, rate limiting).
- Auth via **better-auth** + TOTP 2FA + WalletConnect (wagmi/viem) for web3 login/payment.
- Charts: TradingView Charting Library, `lightweight-charts` as fallback.
- **Standalone Node/TS services** (NOT inside Next.js) for anything long-running/stateful —
  these don't fit the serverless request/response model:
  - `matching-engine` — in-memory order book per trading pair, event-driven
  - `market-data` — WebSocket broadcaster (price ticks, order book, trades)
  - `chain-watcher` — per-chain deposit listeners (start with 1–2 chains, expand later)
  - `workers` — BullMQ workers (withdrawal processing, notifications, scheduled jobs)
  Do not fold these into Next.js API routes even if it seems convenient short-term.

## Repo layout (npm workspaces — root package.json lists `web`, `packages/*`, `services/*`)
```
web/  Next app
  prisma/schema.prisma   generator.output → ../packages/core/generated/prisma
  src/app/               routes & pages (interface layer — keep thin)
  src/lib/               auth, auth-session (RBAC), prisma re-export, wallet provisioning
  src/components/        UI
packages/
  core/                  shared, framework-free (imports nothing from Next). The Prisma
                         client generates here so web + services share ONE client.
    src/ledger.ts        creditDeposit — the one idempotent money-in entry point
    src/wallet/          HD address derivation + wallet provisioning
    generated/prisma/    generated client (gitignored build output)
services/
  chain-watcher/         standalone Node/TS process (BTC esplora + ETH block-scan)
  market-data/           standalone poller (Binance-format tickers → Ticker cache)
  market-maker/          standalone liquidity provider (quotes a ladder around live mid)
  liquidation-engine/    standalone risk service (marks futures positions, liquidates + funding)
  sweeper/               standalone custody service (sweeps deposits into the treasury/hot wallet)
  workers/               (BullMQ, later)
  # NB: spot matching runs in-transaction in packages/core (trading-engine.ts), not a
  # separate matching-engine process — see Phase 5 note below.
docs/ ERD.md, DESIGN_SYSTEM.md, CHANGELOG.md
```
**Dependency rule:** outer → inner only. `packages/core` imports nothing from Next; both the
app and the services depend on it, never the reverse. All money movement flows through
`packages/core/src/ledger.ts` so the invariant can't diverge between processes.

## Hard conventions
1. **Git authorship:** commits authored **"Lewa <omolewastephen@gmail.com>"** (email taken
   from local git config — confirm if a different address is wanted). **Never** add a
   `Co-Authored-By:` trailer or a "Generated with Claude Code" line, on any commit.
2. **No hallucination — verify:** validate the Prisma schema with the CLI before relying on
   it; run domain tests after touching `domain/`. Never claim something works that hasn't
   been run. State clearly what is verified vs. assumed.
3. **Balances are append-only / ledger-style.** Never mutate a balance field directly —
   every credit/debit is a ledger entry; balance is derived (or reconciled) from the ledger.
   This is the money-correctness invariant for the whole system — treat it like ISRMS
   treats the grading engine: fixed, tested, changed deliberately.
4. **Design:** dark-mode-first fintech, premium not templated. No default/AI-ish look —
   that means no Inter/system-font-stack as the only typeface, no generic rounded-card
   grid with uniform shadow, no template-y hero+3-cards layout. Pick a deliberate type
   pairing (a distinct display/heading face + a clean workhorse body face) and a real
   spacing/elevation scale before building screens, and hold to it. Brand: Primary
   `#18C964`, Secondary `#0F172A`, Accent `#2563EB`, Danger `#EF4444`, Warning `#F59E0B`.
   Dark background `#08090C`, cards `#111827`. Light mode: white / very light gray.
   Rounded cards, minimal shadows, glassmorphism where appropriate, smooth animation.
   Build per phase, don't scaffold dozens of half-screens.
5. **Simulate before you integrate real money.** New chains/withdrawal paths should be
   provable against testnets or small amounts before being treated as production-ready.
6. **Changelog every session.** Keep `docs/CHANGELOG.md` with dated entries (newest on top)
   of every feature or notable change, one bullet per change, why not just what if it's
   non-obvious. Update it in the same commit as the work it describes — this is the running
   record of what's been built, separate from and more skimmable than git log.
7. **GitHub + CI/CD:** repo is pushed to GitHub; CI/CD pipeline itself is built in Phase 11
   (Hardening), but the repo should be git-initialized and structured cleanly from Phase 0
   onward so history stays meaningful. Ask before creating the GitHub remote or pushing.

## Build phases (✅ = done)
0. ✅ Foundation: repo scaffold (Next.js 15.5.20 in `web/`, TS strict, Tailwind 4, React 19),
   design system (`docs/DESIGN_SYSTEM.md` — Space Grotesk/Manrope/JetBrains Mono, brand color
   tokens, spacing/radius/elevation scales), shadcn/ui base (Button/Card/Input/Label, set up
   by hand since `ui.shadcn.com` isn't reachable from this environment), Prisma 6.19.3 schema
   for the core ERD (`docs/ERD.md`). Repo pushed to GitHub (private,
   github.com/omolewastephen/tradynance). No Docker/CI yet — deferred per working agreement.
1. ✅ Auth & security: better-auth (Prisma adapter, username + twoFactor plugins), registration
   (email/username/password/country/phone/referral/KYC-agreement), required email verification,
   login with remember-me + full TOTP 2FA step-up, forgot/reset password, 2FA enable/disable UI
   (QR + backup codes), session list/revoke, append-only `LoginHistory`, anti-phishing code,
   RBAC (`middleware.ts` optimistic check + `auth-session.ts` real server-side enforcement).
   Migrated + seeded + exercised end-to-end over real HTTP against local Postgres — see
   docs/CHANGELOG.md for what was verified and what's still a stub (no real email provider yet,
   no Google/Apple OAuth — no credentials for either).
2. ✅ Wallets & deposits: npm-workspaces restructure (`web` + `packages/core` + `services/
   chain-watcher`), shared `creditDeposit` ledger fn, HD address derivation (BTC testnet
   BIP-84, ETH Sepolia BIP-44) with per-wallet `DerivationCounter` index, 16-coin/17-network
   asset catalog seed, `/wallet` + `/wallet/deposit/[symbol]` (address/QR/min-deposit), the
   standalone `chain-watcher` (BTC esplora + ETH block-scan), and the finance-gated admin
   manual-credit fallback (`/admin/deposits`). Verified end-to-end incl. against live BTC
   testnet data — caught + fixed a real double-credit idempotency bug (see docs/CHANGELOG.md).
   Only BTC_TESTNET/ETH_SEPOLIA derive live addresses; ERC-20 tokens + reorg-safe checkpoints
   are deferred. Hot-wallet mnemonic is dev/testnet only.
3. ✅ Withdrawals: shared `packages/core/src/withdrawal.ts` (reserve→settle→release, all
   idempotent; 21-assertion direct test), two-factor confirmation (email OTP always + TOTP if
   2FA else password), `/withdraw` two-step UI with live fee/available, withdrawal-address
   whitelist + "whitelist-only" toggle in Settings, and the finance-gated admin approval queue
   (`/admin/withdrawals`, approve→settle / reject→release, audit-logged). Verified end-to-end
   through the real browser against live Postgres (see docs/CHANGELOG.md). Stubbed: no on-chain
   broadcast (approve settles the ledger + records an admin-provided tx hash); email OTP logs
   to console.
4. ✅ Markets & live data: `services/market-data` polls `data-api.binance.vision` for 14
   USDT markets → `Ticker` cache; `/markets` list (live prices, sort, gainers/losers, search,
   watchlist stars), `/markets/[symbol]` coin page (candlestick chart via `lightweight-charts`
   + klines proxy, interval toolbar, 24h stats), `Watchlist` toggle, and real USD portfolio
   valuation wired into the dashboard (hide-balance toggle) + wallet table (Total/Available/In
   order/Value USD). Verified end-to-end through the browser. Polling not WebSocket streaming
   yet; no order book / recent trades until Phase 5.
5. ✅ Spot trading: pure matching + fee math in `packages/core/src/trading.ts` (tested),
   transactional `placeOrder`/`cancelOrder` settlement in `trading-engine.ts` (Serializable,
   SPOT wallets, TRADE_FILL/FEE ledger, GTC/IOC/FOK), `services/market-maker` liquidity,
   `/trade/[symbol]` 3-col UI (chart + order book/trades + order form + open-orders/history).
   Verified end-to-end incl. a browser fill against MM liquidity + a 19-assertion core test
   (conservation checked). **Deviation from the locked stack**: matching runs in-transaction,
   NOT a standalone in-memory `matching-engine` process — correctness-first; the async engine
   is a throughput optimization for later. Fees leave user balances but aren't collected to a
   platform wallet yet; liquidity is a demo market-maker.
6. ✅ Portfolio & dashboard: `/portfolio` (total value + real 24h change from tickers,
   allocation donut [dependency-free SVG], performance chart [Σ current-holding × historical
   klines close, ranges 24h/7d/30d], holdings table, recent-activity feed from the ledger).
   Read-only analytics — no new tables. Verified end-to-end. Full cost-basis realized/unrealized
   PnL deferred (needs acquisition accounting); shown as change %, not P&L.
7. ✅ Convert: `packages/core/src/convert.ts` (transactional swap, SPOT wallets, price×spread,
   two CONVERSION ledger entries, Conversion history row; server-re-priced), `/convert` swap
   UI + history, wired to nav. 8-assertion core test + browser-verified. Spread is platform
   revenue (unmodeled like trade fees).
8. ✅ Admin panel core: `/admin` dashboard (real stats), `/admin/users` (paginated list +
   search) + `/admin/users/[id]` (detail + status/KYC/role/2FA controls, self- & super-admin
   guards, all audit-logged), `/admin/kyc` (approve/reject; doc upload deferred), `/admin/audit`
   (paginated append-only viewer). Role groups in `src/lib/admin.ts`; server-side `requireRole`.
   Deposits/withdrawals admin already existed. Verified end-to-end (RBAC, actions → DB + audit).
   Also a **perf pass**: charts code-split (−~49 kB/route First Load JS), `/api/markets` cached
   (5s + SWR), AuditLog/User createdAt indexes.
9. ✅ Margin & futures (isolated margin): `packages/core/src/futures.ts` (open/close/liquidate/
   funding, FUTURES_MARGIN/FUTURES_PNL/FUNDING/LIQUIDATION ledger, isolated-loss guarantee,
   equity-based liquidation, taker fees; pure PnL/equity/liq-price helpers), `FuturesPosition`
   model + PositionSide/PositionStatus enums, `services/liquidation-engine` (marks OPEN positions
   to live price, force-closes maintenance-margin breaches, accrues funding), `/futures/[symbol]`
   UI (leverage slider, live-PnL positions, close, history). 29-assertion core test + browser E2E
   + live-engine liquidation verified. **Deferred:** cross margin, advanced order types (OCO,
   trailing stop, iceberg, reduce-only).
10. ✅ Long-tail features: **notifications** (Notification model + `notify()`; topbar bell +
    `/notifications`; wired to deposit/withdrawal/fill/liquidation), **referrals** (fee-rebate
    commissions off FEE ledger entries, idempotent; `/referrals` dashboard), **VIP tiers**
    (30d-volume taker-fee discounts via `takerFeeBpsOverride`; `/vip`), **staking** (StakingProduct/
    StakePosition, on-demand reward accrual, STAKE/STAKING_REWARD ledger; `/staking`), **launchpad**
    (project + additive commitment/claim, LAUNCHPAD ledger; `/launchpad`), **NFT marketplace**
    (collection/NFT/listing, list/buy/cancel with buyer→seller USDT settlement + 2% fee,
    deterministic SVG art; `/nft`). Each: core fn + direct test (notif/referrals/vip/staking/
    launchpad/nft, all conservation-checked) + browser E2E. `services/liquidation-engine` unchanged.
11. ✅ Hardening: **rate limiting** (better-auth built-in on the auth surface + an in-process
    sliding-window limiter on withdrawal request/confirm + order placement), **audit completeness**
    (shared IP-capturing `recordAudit`; user security/money events now logged, not just admin),
    **monitoring** (env-gated `@sentry/nextjs` — server `instrumentation` + `observability.ts` seam
    + lazy client error boundary; kept First Load JS / middleware at baseline), **CI/CD**
    (`.github/workflows/ci.yml`: Postgres service → migrate → seed-ci → typecheck/lint/test:core/
    build; `seed-tickers.ts` + `seed-ci.ts` make the suite CI-runnable). **Build plan complete.**

### Post-plan enhancements
13. ✅ Design uplift + marketing + CMS: design system **v2 "Onyx & Emerald"** (deepened emerald,
    electric-blue accent, onyx neutrals, glow/gradient utilities; new gradient logo tile — all via
    CSS-var tokens so the app changed in one move), a public **marketing site** (`(marketing)`
    group: home w/ live tickers, about, blog, contact) built on it, and an **admin CMS**
    (`/admin/blog` CRUD, `/admin/messages` inbox, `/admin/content` copy editor; `Post`/
    `ContactMessage`/`SiteContent` models; `CONTENT_ROLES`, audit-logged). Marketing copy is
    admin-editable with code defaults. **Deposit note:** per-user deposit addresses are mapped but
    **not swept** to a central wallet, and the hot-wallet index collides with the first deposit
    index — both queued as the **deposit-sweeper** track.

12. ✅ Real value movement (turns the custody simulation real, all env-gated — inert until you
    supply the credential): **email** (`src/lib/email.ts` — Resend HTTP API + console fallback;
    reset/verification/withdrawal-OTP emails now real, branded, anti-phishing-stamped),
    **on-chain withdrawal broadcast** (`packages/core/src/chain/` — signs + broadcasts native ETH
    from the hot wallet on Sepolia via viem; admin approve broadcasts→records hash→settles, manual
    fallback for BTC; verified reaching the chain, needs the hot wallet funded), **pay-from-wallet**
    (`components/web3/` — viem + `window.ethereum`, send a deposit from a browser wallet to your
    Sepolia deposit address; route-isolated chunk). Deferred: BTC broadcast, WalletConnect QR/mobile,
    SIWE web3 login, ERC-20 tokens.

## Running locally
From the repo root:
```
npm install            # once (npm workspaces)
npm run dev            # ensures Postgres is up, then starts web + market-data + market-maker
                       #   + liquidation-engine → http://localhost:3000, color-prefixed logs
```
First-time DB setup: `cd web && npx prisma migrate deploy && npm run db:seed`.
Seeded logins: admin@tradynance.local / ChangeMe123!, trader1@example.com / Password123.
Trading uses SPOT-network wallets — fund via Admin → Deposits (network `SPOT`).
Env lives in `web/.env` (gitignored); see `web/.env.example`.

## Working agreement
Work phase by phase. At the end of each phase: update the checklist above, run the relevant
tests, and commit. Ask before large architectural changes and before anything that touches
real funds/real chains beyond testnet.
