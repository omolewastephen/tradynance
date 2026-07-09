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

## Repo layout (clean architecture)
```
web/  Next app
  prisma/schema.prisma
  src/app/               routes & pages (interface layer — keep thin)
  src/lib/               prisma singleton, auth, web3 client config, utils
  src/server/
    domain/              pure business rules, framework-free, UNIT-TESTED
                          (ledger.ts, matching math, fee calc, liquidation math)
    application/         use-cases (orchestrate domain + repos)
    infrastructure/      prisma repositories, redis client, chain clients
  src/components/        UI
services/
  matching-engine/       standalone Node/TS process
  market-data/           standalone Node/TS process
  chain-watcher/         standalone Node/TS process
  workers/               BullMQ workers
docs/ ERD.md, ARCHITECTURE.md, COMPLIANCE.md
```
**Dependency rule:** outer → inner only. `domain/` imports nothing from Prisma/Next.

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
1. ⬅ **NEXT** — Auth & security: registration/login, email verification, TOTP 2FA, RBAC,
   session/device management, login history, anti-phishing code.
2. Wallets & deposits: coin/network models, HD address generation, deposit address UI + QR,
   `chain-watcher` service (1–2 chains first), manual admin-confirm fallback, ledger credits.
3. Withdrawals: request flow, OTP/2FA/email confirmation, admin approval queue, fees,
   withdrawal whitelist.
4. Markets & live data: `market-data` service, price feed, market list/coin detail pages,
   watchlist.
5. Spot trading: `matching-engine` service, order form (market/limit), order book UI, trade
   history, open orders, GTC/IOC/FOK.
6. Portfolio & dashboard: overview, balances, PnL, asset allocation + performance charts.
7. Convert: instant asset conversion via market price + spread.
8. Admin panel core: user management, deposit/withdrawal management, KYC review, audit logs
   (append-only, nothing deletable).
9. Margin & futures: leverage, liquidation engine, funding rate, advanced order types
   (OCO, trailing stop, iceberg, reduce-only).
10. Long-tail features (only after 0–9 are solid): notifications, referrals, VIP tiers,
    staking, launchpad, NFT marketplace.
11. Hardening: rate limiting, audit trail completeness, monitoring (Sentry), CI/CD.

## Working agreement
Work phase by phase. At the end of each phase: update the checklist above, run the relevant
tests, and commit. Ask before large architectural changes and before anything that touches
real funds/real chains beyond testnet.
