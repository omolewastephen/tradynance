# Changelog

Dated, newest first. One bullet per change; note *why* when it's not obvious. This is the
skimmable running record — see `git log` for full diffs.

## 2026-07-12 — Phase 10f: NFT marketplace
- **`packages/core/src/nft.ts`** — list / cancel / buy. NFTs are unique (ownership is `Nft.ownerId`,
  not a wallet balance), so only the USDT payment touches the ledger: `buyNft` in ONE transaction
  debits the buyer (`NFT` entry), credits the seller minus a 2% marketplace fee (`NFT` entry),
  transfers ownership, and closes the listing. Fee is platform revenue (unmodeled sink). List/cancel
  are ownership-guarded and move no money.
- **Schema**: `NftCollection`, `Nft`, `NftListing` (+ `ListingStatus`), `NFT` ledger type
  (migration `20260712012048_nft_marketplace`). Seeded a "Tradynance Genesis" collection of 8
  listed NFTs owned by an `nft-creator` system user (idempotent `seed-nft.ts`).
- **Generative art, zero external assets**: `web/src/lib/nft-art.ts` turns each NFT's `imageSeed`
  into a deterministic gradient-and-shapes **SVG** rendered as a data URI — no images to host/fetch,
  same seed → same art.
- **`/nft` page**: Marketplace tab (grid of listings, buy / your-listing+unlist) and My NFTs tab
  (owned pieces with list / unlist). Nav entry.
- **Verified**: 19-assertion core test (`nft-test.ts`) — list guards, buy debits buyer + credits
  seller net of fee + transfers ownership + marks SOLD + notifies both, two-party conservation
  (fee to platform), relist/cancel guards, insufficient funds. Browser: bought Zenith #08 for 180
  USDT (balance −180 exactly, moved to My NFTs, relist UI shown), no console errors.

## 2026-07-12 — Phase 10e: Launchpad
- **`packages/core/src/launchpad.ts`** — token sales with the usual ledger discipline.
  `commitToLaunchpad` debits the sale asset (USDT) from the SPOT wallet (a `LAUNCHPAD` entry),
  allocates `amount / tokenPrice` tokens, bumps `soldAllocation`, and records an additive
  per-user commitment; `claimLaunchpad` (once the project is DISTRIBUTED) credits the token asset
  to the SPOT wallet. Guards: min/max-per-user, remaining allocation, LIVE-only commit,
  DISTRIBUTED-only + single claim. Proceeds/token supply are unmodeled platform sinks/sources.
- **Schema**: `LaunchpadProject` + `LaunchpadCommitment` (+ `LaunchpadStatus`), `LAUNCHPAD`
  ledger type (migration `20260712010258_launchpad`). 3 seeded projects (idempotent
  `seed-launchpad.ts`), each selling its own token Asset: NovaChain (LIVE), AetherFi (UPCOMING),
  Pulsar (DISTRIBUTED) — so the whole commit→claim flow is demoable.
- **`/launchpad` page**: project cards with status badge, allocation progress bar, min/max, sale
  window, your commitment/allocation, and a per-status action (commit / opens-soon / claim /
  ended). Nav entry.
- **Verified**: 15-assertion core test (`launchpad-test.ts`) — commit debits + allocates,
  additive commits, min/max/allocation/insufficient/not-live rejected, claim only after
  DISTRIBUTED credits the token once (double-claim rejected), conservation on both assets.
  Browser: committed 500 USDT → 2,000 NOVA on the LIVE project, no console errors.

## 2026-07-12 — Phase 10d: Staking
- **`packages/core/src/staking.ts`** — stake an asset for yield, same ledger discipline: `stake`
  debits principal from the SPOT wallet (a `STAKE` entry) and opens a `StakePosition`; `redeemStake`
  returns principal (`STAKE` credit) + earned yield (`STAKING_REWARD` credit). Rewards accrue
  **continuously and are computed on demand** from elapsed time (`accruedReward`, pure) — no
  background job to drift; locked stakes stop accruing at unlock; flexible (lockDays 0) redeem
  anytime, locked can't redeem early. Reward is platform yield (unmodeled source, like fees).
- **Schema**: `StakingProduct` + `StakePosition` (+ `StakeStatus`) models, `STAKE` /
  `STAKING_REWARD` ledger types (migration `20260711234504_staking`). 6 products seeded
  (`prisma/seed-staking.ts`, idempotent, wired into the main seed): USDT flexible/30d/90d
  (8/12/16%), BTC flexible (2.5%), ETH 30d (5%), SOL 60d (9%).
- **`/staking` page**: product cards (APR, lock, min, available, stake input) + a "Your stakes"
  table with **live-ticking accrued reward** and redeem (disabled while locked) + history. Nav entry.
- **Verified**: 14-assertion core test (`staking-test.ts`) — accrual math, principal debit, redeem
  returns principal+reward, `STAKE`/`STAKING_REWARD` entries, no early locked redeem, double-redeem
  rejected, insufficient/below-min rejected, **ledger conservation**. Browser: staked 2000 USDT
  (live reward accrued), redeemed, no console errors.

## 2026-07-12 — Phase 10c: VIP tiers
- **`packages/core/src/vip.ts`** — 5 volume-based tiers (VIP 0–4) with taker-fee discounts
  (10–35%). `get30dVolume` sums a user's trailing-30-day spot filled quote + futures notional;
  `vipTierFor` selects the tier; `effectiveTakerBps` applies the discount.
- **Genuinely wired into fees, low-risk**: rather than run volume queries inside the money-
  critical settlement, the action layer computes the user's discounted taker bps
  (`effectiveTakerBpsForUser`) and passes it as an optional `takerFeeBpsOverride` into
  `placeOrder` / `openPosition` / `closePosition` — the engines just do `override ?? base`.
  VIP 0 → no override → base fees, so existing behaviour + conservation tests are unchanged.
  Applied to spot taker + futures open/close (all taker); maker-side discount deferred (resting
  liquidity is the system market-maker).
- **`/vip` page**: current tier, live 30-day volume, progress bar to the next tier, and the full
  tier table with effective taker fees — added to the nav.
- **Verified**: 12-assertion pure test (`vip-test.ts`) for tier selection + discount math; all
  money tests still green with a clean book (trading **19**, futures **29**, convert 8,
  withdrawal 21, referrals 9). Browser: `/vip` shows trader1 at VIP 0 with a real $10k 30-day
  volume and correct fee table, no console errors.
  - *Test-robustness fix*: `trading-test` counted trades **globally** (`prisma.trade.count()`),
    which broke once real demo trades existed — scoped it to the run's own maker/taker. (Core
    money tests must be run with the dev stack's market-maker stopped, else its resting book
    crosses the tests' orders.)

## 2026-07-12 — Phase 10b: Referrals
- **Earning**: a referrer earns a rebate (`REFERRAL_COMMISSION_BPS`, default 20%) on the trading
  fees their referees pay. Rather than inject payouts into the conservation-tested spot/futures
  settlement, `packages/core/src/referrals.ts` `settleReferralCommissionsForUser` derives
  commissions from the FEE ledger entries those trades already write — one `ReferralCommission`
  per fee entry, keyed by the fee entry id (`ledgerEntryId` UNIQUE) so it's **fully idempotent**.
  The rebate is a `REFERRAL_COMMISSION` ledger credit on the referrer's SPOT wallet in the fee's
  asset (from platform fee revenue — never touches the referee).
- **`ReferralCommission` model** + `REFERRAL_COMMISSION` ledger type (migration
  `20260711231911_referral_commissions`). The referral tree itself (`referralCode`/`referredById`)
  already existed from Phase 1.
- **Wired** into the spot `submitOrder` and futures open/close actions (best-effort, post-fill,
  idempotent — a failed settle never fails the trade). Covers spot + futures fees.
- **`/referrals` dashboard**: referral code + copy-able invite link (`/register?ref=CODE`, which
  the register form already reads), stats (total referrals / commission earned / rate), the list
  of referred users, and commission history. Added to the nav.
- **Verified**: 9-assertion core test (`referrals-test.ts`) — commission = fees × rate, credited
  to the referrer's wallet, `ReferralCommission` rows + `REFERRAL_COMMISSION` ledger entries,
  idempotent re-settle is a no-op, referrer notified, no-referrer earns nothing. Browser: the
  dashboard renders code/link/stats/history correctly (demo referral → 5.54 USDT across 3 fees),
  no console errors.

## 2026-07-12 — Phase 10a: Notifications
- **`Notification` model** + `NotificationType` enum (DEPOSIT/WITHDRAWAL/TRADE/LIQUIDATION/
  REFERRAL/STAKING/LAUNCHPAD/SECURITY/SYSTEM), migration `20260711230425_notifications`.
- **`packages/core/src/notifications.ts`** — `notify(client, {...})` write helper that accepts
  either the base client or a transaction client, so money functions can emit in-tx where
  there's no other chokepoint, and the app/service layers emit post-tx otherwise (a failed
  notification must never roll back money).
- **Wired to real events**: deposit credited (in `creditDeposit`, the one chokepoint the
  chain-watcher + admin credit both pass through), position liquidated (in `settleAtMark`,
  emitted by the liquidation engine), order filled (in the `submitOrder` action, post-tx),
  withdrawal completed/rejected (in the admin withdrawal actions).
- **In-app center**: a topbar **bell** with an unread badge (polls `/api/notifications` every
  20 s) + dropdown of the 12 most recent, and a full `/notifications` page (mark-one/mark-all
  read, per-type icons). Mark-read actions are userId-scoped so a user can only touch their own.
- **Verified**: futures core test still 29/29 (liquidation now also writes a notification, cleanup
  updated). Browser E2E: a marketable limit BUY filled against the market-maker → the bell showed
  **1 unread** with "Order filled — BUY 0.002 BTCUSDT @ 64361.63", dropdown + full page render,
  no console errors.

## 2026-07-11 — Phase 9: Margin & futures (isolated-margin perpetuals)
- **`packages/core/src/futures.ts`** — the risk core. Isolated-margin perpetual positions with
  the same money discipline as the rest: collateral (`margin`, quote asset) is debited from the
  user's SPOT wallet on open (one `FUTURES_MARGIN` + one `FEE` ledger entry) and settled back
  on close/liquidation (`FUTURES_PNL`/`LIQUIDATION` + `FEE`), balance is the cache. `size =
  margin × leverage / entryPrice`; entry = live mark (Ticker). A taker fee (`market.takerFeeBps`,
  on notional) is charged on open and close, exactly like spot.
  - Pure, unit-tested helpers: `unrealizedPnl`, `positionEquity`, `isLiquidatable` (equity ≤
    maintenance margin, mmr 0.5%), `liquidationPriceFor` (display).
  - Isolated guarantee: the most a user can lose is their margin — settlement credits
    `max(0, margin + uPnL − fundingAccrued) − closeFee`, floored at 0; any deficit is the
    platform's. Funding accrues per interval (`accrueFunding`, LONG pays when rate > 0),
    realized into the settlement figure at close. Funding rate is a fixed nominal (simplified,
    not premium-derived).
- **Schema** (migration `20260711170152_futures_positions`): `FuturesPosition` model +
  `PositionSide`/`PositionStatus` enums; `LedgerEntryType` gains `FUTURES_MARGIN`,
  `FUTURES_PNL`, `FUNDING`, `LIQUIDATION`.
- **`services/liquidation-engine`** — standalone risk service (thin loop over the core, like
  chain-watcher/market-maker): every 5 s it marks every OPEN position to its market's live price
  and force-closes any whose equity has breached maintenance margin; every funding interval it
  accrues funding on open positions. Wired into `npm run dev`.
- **UI** `/futures/[symbol]`: chart + a Long/Short position form (leverage slider 1–50× with
  quick-picks, margin input with %, live preview of size/notional/est. liq price/fee/cost) and a
  positions panel — open positions with **live unrealized PnL + ROE** (polls the mark every 4 s),
  liq price, margin, one-click close; plus closed/liquidated history. `Futures` added to the nav
  and a Futures button on the coin page.
- **Verified**: 29-assertion direct core test (`futures-test.ts`) — open debits margin+fee,
  size/entry/liq math, PnL realized at a moved mark, **liquidation seizes margin at a breach**,
  funding accrual, leverage/margin/insufficient-funds rejection, and **ledger conservation**
  (Σ entries == balance delta). Browser E2E: opened a LONG 10× through the UI (ledger
  `FUTURES_MARGIN −1000` + `FEE −20`, balance 50000→48980), closed it (`FUTURES_PNL +1000` +
  `FEE −20` → 49960), history + live PnL render, no console errors. The **live running
  liquidation-engine** force-closed a position driven below its liq price (LIQUIDATED, full
  margin seized).
- **Deferred (documented)**: cross margin (isolated only for now) and advanced order types
  (OCO, trailing stop, iceberg, reduce-only) — order-management features layered on top of this
  risk core, not part of it.

## 2026-07-11 — Performance pass
- **Code-split the charts**: `lightweight-charts` is now loaded via dynamic `import()` inside
  the chart components instead of a static top-level import, so it ships as a separate async
  chunk. **First Load JS dropped ~48–49 kB** on every chart route (markets/[symbol] 165→116 kB,
  trade/[symbol] 164→115 kB, portfolio 160→112 kB).
- **Cached the shared hot API**: `/api/markets` (same payload for all users, refreshed every
  ~10s) now sends `Cache-Control: max-age=5, stale-while-revalidate=10`, so the 10s client
  poll doesn't hit the DB every tick under load. Per-symbol order book/trades stay uncached
  (need 3s freshness).
- **Indexes** for the new admin hot paths: `AuditLog(createdAt)` and `User(createdAt)` (both
  ordered newest-first). Confirmed runtime pages already parallelize queries (Promise.all) with
  no N+1 loops.

## 2026-07-11 — Phase 8: Admin panel core
- **Admin dashboard** (`/admin`) with real stats: users (total/active, excluding the
  market-maker system account), pending KYC / deposits / withdrawals, trade count + quote
  volume, fee revenue (Σ taker+maker fees), conversions — all parallel queries — plus Manage
  quick-links.
- **User management**: `/admin/users` paginated list (25/page) with email/username search;
  `/admin/users/[id]` detail (profile, aggregated balances, activity counts, recent ledger)
  with action controls — set status (ACTIVE/SUSPENDED/FROZEN/BANNED), set KYC, change role
  (SUPER_ADMIN only), reset 2FA. Guards: can't act on yourself or on a super admin; role
  changes are super-admin-only (privilege-escalation guard). Every action is **audit-logged**.
- **KYC review** (`/admin/kyc`): pending queue + approve/reject → VERIFIED/REJECTED, plus a
  recently-reviewed list. (Document upload isn't wired — review operates on the status field;
  noted in the UI.)
- **Audit log viewer** (`/admin/audit`): paginated (40/page), append-only, actor email +
  action + entity + metadata. Any admin role incl. read-only AUDITOR can view.
- Wired the full admin section into the sidebar. Role gating enforced server-side via
  `requireRole` in `src/lib/admin.ts` role groups.
- **Verified end-to-end** through the browser: RBAC (a USER hitting `/admin/users` is
  redirected to `/dashboard`), suspending a user + approving KYC both reflected in the DB and
  written to the append-only audit log (attributed to admin, with metadata), dashboard stats
  and audit viewer render. No console errors.

## 2026-07-11 — Phase 7: Convert
- **`packages/core/src/convert.ts`** — instant asset swap, same ledger discipline as the rest:
  debit the from-asset and credit the to-asset in ONE transaction, each a CONVERSION ledger
  entry. `toAmount = fromAmount × (priceFrom/priceTo) × (1 − spread)`; the platform keeps a
  spread (`CONVERT_SPREAD_BPS`, default 0.30%), so value out = value in × (1 − spread) — the
  spread is platform revenue, same pattern as trade fees. Prices come from the Ticker cache
  and are **re-priced server-side at execution**, so a stale client quote can't be exploited.
  Operates on SPOT wallets. Records a `Conversion` row for history.
- **Schema**: `Conversion` model (from/to asset, amounts, effective rate). Migration
  `20260710235710_convert`.
- **`/convert`** page: a from/to swap card (asset selectors with SPOT balances, amount, a
  live server-priced quote showing rate + spread, a swap-direction button) and a conversion
  history table. Wired into the sidebar.
- **Verified**: 8-assertion direct test (spread applied, correct debit/credit, two CONVERSION
  ledger entries, Conversion row, value = in × (1−spread), same-asset + insufficient-funds
  rejected) plus a real browser convert — 6400 USDT → 0.09961909 BTC, settled exactly (USDT
  −6400, BTC credited, two ledger rows, history row with rate). No console errors.

## 2026-07-11 — Phase 6: Portfolio & dashboard
- **`/portfolio`** page: total value + 24h change, an allocation donut, a performance chart
  with 24h/7d/30d ranges, a holdings table (amount / price / 24h% / value / allocation%), and
  a recent-activity feed. Read-only analytics over existing data — no new tables, no migration.
- **24h change** is real, no snapshot infra: computed from each asset's ticker 24h % against
  current holdings (`price_24h_ago = price / (1 + pct/100)`), summed. `src/lib/portfolio.ts`.
- **Performance chart** (`/api/portfolio/performance`): value over time = Σ(current holding ×
  historical close) from real klines. Labeled "current holdings at historical prices" — it's a
  legitimate "what my portfolio would've been worth" view, not a mark-to-market reconstruction
  of past holdings (which would need snapshots). Uses real price data, immediately populated
  (verified: 42 points over 7d, $51.4k→$52.2k).
- **Allocation donut** is a dependency-free inline SVG (`components/charts/donut.tsx`) with a
  categorical palette; tiny slices roll into "Other". **Recent activity** reads the append-only
  ledger (the real movement record).
- Wired Portfolio into the sidebar. Verified end-to-end through the browser with a diversified
  holding (0.5 BTC + 5 ETH + 40 SOL + 8k USDT → correct $52,198 total, donut 61.5/17.2/15.3/6.0,
  live 24h per row). No console errors.
- **Deferred**: full cost-basis realized/unrealized PnL (needs acquisition accounting) and
  margin balance (Phase 9) — shown as change %, not P&L, to stay honest.

## 2026-07-10 — Phase 5: Spot trading
- **`packages/core/src/trading.ts`** — pure, unit-tested matching: price-time priority,
  market/limit, GTC/IOC/FOK, fee math. No DB.
- **`packages/core/src/trading-engine.ts`** — `placeOrder`/`cancelOrder`, transactional
  settlement holding the same ledger invariant as deposits/withdrawals: crossing fills settle
  immediately (base ↔ quote moves + fees, both taker and maker, one LedgerEntry each), a GTC
  limit remainder rests and locks funds, IOC/MARKET leftovers cancel, FOK is all-or-nothing.
  Runs at **Serializable** isolation so two crossing orders can't double-fill the same
  liquidity. Trading uses a per-(user,asset) **SPOT wallet** (network="SPOT"), separate from
  deposit wallets — a funding↔spot transfer is deferred (mirrors Binance's Funding vs Spot).
- **Architecture note**: matching runs in-transaction (correctness-first), a deliberate
  deviation from the "standalone in-memory matching-engine" in CLAUDE.md's stack — that's a
  throughput optimization for later. The money-critical logic lives in `core` and is tested.
- **`services/market-maker`** — new standalone liquidity service. A funded system user quotes
  a 6-level bid/ask ladder around each market's live mid-price (from the Ticker cache),
  through the same `placeOrder` path users use, so the order book looks real and user orders
  have something to fill against. Re-centers on drift, tops up consumed levels.
- **Trade page** `/trade/[symbol]` (+ `/trade` → BTCUSDT): the classic 3-column exchange
  layout — candlestick chart | order book + market-trades tabs (live depth bars, spread) |
  order form (Buy/Sell, Limit/Market, price, amount, %-slider, GTC/IOC/FOK, available balance,
  total) — with open-orders (cancelable) + order-history tabs below and a pair selector.
- **API**: `/api/markets/[symbol]/orderbook` (aggregated depth) and `/trades` (recent tape),
  plus `submitOrder`/`cancelUserOrder` server actions. Wired Trade into the sidebar and the
  coin page's Trade button.
- **Verified end-to-end** through the browser against live Postgres: MM seeded a real
  6+6 book, a user order **filled against MM liquidity** and settled exactly — BTC +0.1,
  USDT −6394.07 −12.79 (0.2% taker) fee = 43593.15, one Trade row, three ledger entries
  (quote out / fee / base in). Backed by a **19-assertion direct test** of the matching math
  (market/limit/partial fills, IOC/FOK, cancel-releases-lock, insufficient funds, and
  **conservation**: base nets to zero across users, quote delta equals exactly the fees).
- **Notes**: order matching/settlement is transactional (not a separate async engine);
  liquidity is a demo market-maker, not a real one; fees currently just leave user balances
  (no platform fee-collection wallet yet). Order book polls every 3s (not a WS stream).

## 2026-07-10 — Phase 4: Markets & live data
- **`services/market-data`** — new standalone poller. Fetches Binance-format 24h tickers for
  our 14 markets from `data-api.binance.vision` (public, no key; `api.binance.com` is
  geo-blocked here) every 10s and upserts a `Ticker` row per market. A price cache, not a
  source of truth for anything money-related.
- **Schema**: `Ticker` (live price + 24h high/low/volume/change per market) and `Watchlist`;
  seeded 14 USDT spot markets (BTC…TON). Migration `20260710154827_markets_ticker_watchlist`.
- **Markets list** (`/markets`): sortable table with coin icons, live price, colored 24h %,
  high/low/volume, All / Top gainers / Top losers / Watchlist tabs, search, and watchlist
  stars. Client polls `/api/markets` every 10s for live updates.
- **Coin detail** (`/markets/[symbol]`): price header + 24h change, a real **candlestick
  chart** (`lightweight-charts` v5) fed by a server-side klines proxy
  (`/api/markets/[symbol]/klines`), an interval toolbar (15m/1h/4h/1d/1w), and a 24h stats row.
- **Watchlist**: `toggleWatchlist` server action, optimistic star on both the list and detail,
  and a Watchlist tab filter.
- **Real USD valuation** wired in from live prices (`src/lib/prices.ts`): the **dashboard
  hero** now shows the portfolio's actual USD value (verified: 0.5 BTC + 4 ETH → $39,213 at
  live prices) with a **hide-balance eye toggle**; the **wallet table** gained
  Total / Available / In order / **Value (USD)** columns and an estimated-value header — the
  columns picked up from the reference screenshots the user shared.
- Verified end-to-end through the real browser: market-data populated 14/14 tickers, markets
  list renders live prices, the candlestick chart renders from real klines, watchlist toggles,
  and the dashboard shows the correct USD total. **Found + fixed a real bug by running it**:
  the coin page 500'd on `Intl.NumberFormat` because 24h-volume formatting set
  `maximumFractionDigits` (0) below `minimumFractionDigits` (2) — clamped it.
- **Notes**: prices come from a public data mirror (values look ~2024-era — it's a replayed
  feed in this environment, but real-shaped and proves the integration). It's polling, not a
  true WebSocket stream yet (the eventual `market-data` broadcaster design); 10s client polling
  is the honest MVP. No order book / recent-trades yet — those come with spot trading (Phase 5).

## 2026-07-10 — Phase 3: Withdrawals
- **`packages/core/src/withdrawal.ts`** — the debit side of the ledger, same discipline as
  `creditDeposit`. Model: **reserve → settle**, with **release** on reject/cancel.
  `reserveWithdrawalFunds` locks amount+fee against the wallet (available = balance − locked)
  with no balance change or ledger entry yet; `settleWithdrawal` writes ONE append-only
  −(amount+fee) WITHDRAWAL entry, drops balance and lock in one tx; `releaseWithdrawal`
  unlocks without moving money. All idempotent. 21-assertion direct test in
  `scripts/withdrawal-test.ts` (lock/settle/release math, idempotency, insufficient-funds).
- **Two-factor withdrawal confirmation**: always an **email OTP** (6-digit, hashed,
  single-use, 10-min TTL, logged to console in dev), plus a second factor — **TOTP** if the
  account has 2FA (verified via `auth.api.verifyTOTP`, which works for an already-authenticated
  user), else the **account password** (`auth.api.verifyPassword`). Covers the spec's
  OTP/email/2FA verification items with real, verifiable checks.
- **Flow / states**: request → `AWAITING_CONFIRMATION` (funds NOT yet locked) → confirm →
  `PENDING` (funds locked) → admin approve → `COMPLETED` (settled) or reject → `REJECTED`
  (lock released). User can cancel while pending. `(network,txOutputIndex)`-style idempotency
  keys not needed here — the state machine + idempotent core fns guard double-settlement.
- **UI**: `/withdraw` two-step form (asset/network/address/amount → email-OTP + 2FA/password
  confirm) with live fee + available-balance + total-debit display and whitelist quick-pick;
  **withdrawal address whitelist** management in Settings → Security (add/remove + a
  "whitelist-only" toggle that blocks non-listed destinations); **admin approval queue** at
  `/admin/withdrawals` (approve→settle with optional tx hash, reject→release, both audit-logged).
- **Schema**: `Withdrawal` confirmation fields + `AWAITING_CONFIRMATION` status,
  `WithdrawalWhitelist` model, `User.withdrawalWhitelistOnly`. Migrations
  `20260710131743_withdrawal_status_enum` + `20260710131744_withdrawals` — split in two
  because Postgres won't let a newly-added enum value be used (as a column default) in the
  same transaction that adds it.
- **Verified end-to-end** against live local Postgres through the real browser UI: request →
  OTP (read from log) → confirm (funds locked, no ledger entry, available reduced) → admin
  approve (balance debited to exactly amount+fee, lock released, one WITHDRAWAL ledger row,
  COMPLETED + txHash + audit) → and a second withdrawal rejected (lock released, balance
  unchanged, no ledger entry). Not just type-checked.
- **Still stubbed**: no real on-chain broadcast — "approve" settles the ledger and records a
  tx hash the admin provides; actual signing/sending from the hot wallet is future work. Email
  OTP logs to console (no email provider yet).

## 2026-07-10 — UI polish pass (app shell, brand, coin icons)
- Moved from a thin top-nav to a real **app shell**: persistent left **sidebar** (lucide
  icons, active-state highlighting, admin section) + a **glass sticky topbar** (user chip +
  sign out). Collapses to a horizontal scroll nav on mobile — verified responsive at 390px.
- **Logo mark**: inline SVG (a "T" with a rising-arrow/candlestick motif in brand green),
  `components/brand/logo.tsx`. Added to the sidebar and a new `(auth)` layout with an ambient
  brand glow behind the auth cards.
- **Real coin icons**: copied the 16 coins we list from `cryptocurrency-icons` into
  `public/coins/` (then removed the 400-icon package — the SVGs are static now), rendered via
  `components/brand/coin-icon.tsx` with a generic fallback (TON has no icon in the set).
- **Dashboard** rebuilt as an overview: portfolio hero (with honest "$0.00 / valuation lands
  in Phase 4" framing — no fake PnL), a 4-up stat-tile row (assets held / KYC / role / status),
  quick actions, and a fund-your-account card. **Wallet** table got coin icons, denser rows,
  and hover states.
- **Subtle motion**: a 220ms `fade-rise` entrance on page roots (transform+opacity only,
  `prefers-reduced-motion`-aware). No layout-animating, no decorative-only motion.
- Deliberately did this as one pass after the core screens existed (per the working
  agreement) rather than restyling each phase. Full build + lint clean; no console errors.

## 2026-07-10 — Phase 2: Wallets & deposits
- **Restructured into npm workspaces**: `web/`, `packages/core/` (shared, framework-free),
  `services/chain-watcher/`. The Prisma client now generates into `packages/core/generated`
  so the app and the standalone watcher share the exact same client + money-movement code.
- **`packages/core/src/ledger.ts` — `creditDeposit`**: the single, idempotent place money
  enters a balance. Writes one append-only `LedgerEntry` + bumps the cached `Wallet.balance`
  in one transaction; a no-op on an already-CREDITED deposit. Both the watcher and the admin
  fallback call it, so the money-correctness invariant can't drift between processes.
- **HD deposit-address derivation** (`packages/core/src/wallet/derivation.ts`) from a single
  BIP-39 mnemonic: BTC testnet (BIP-84 p2wpkh via `@scure/btc-signer`) and ETH Sepolia
  (BIP-44 coin-60 via viem). Verified deterministic and against known BIP test vectors
  (`scripts/derive-test.ts`). Each wallet gets a monotonic `derivationIndex` from a
  `DerivationCounter` row, assigned in the same tx as the wallet insert so addresses can't collide.
- **Schema**: `Wallet.derivationIndex`, `DerivationCounter`, `Deposit.txOutputIndex` +
  `source` (CHAIN/MANUAL), unique `(network, txHash, txOutputIndex)` as the on-chain
  idempotency key. Migration `20260710102403_wallets_deposits`.
- **Asset catalog seeded**: 16 coins / 17 networks from the spec. Only BTC_TESTNET and
  ETH_SEPOLIA derive live addresses; the rest are catalog entries (deposit page shows a clear
  "not enabled yet" state) until those chains are integrated.
- **Wallet + deposit UI**: `/wallet` balance list, `/wallet/deposit/[symbol]` with network
  selector, derived address, server-generated QR, min-deposit, memo warning, recent deposits.
- **`services/chain-watcher`**: standalone polling process — BTC via esplora, ETH via viem
  block-scan — recording deposits and crediting once confirmations clear the threshold.
  **Found and fixed a real double-credit bug by running it against live BTC testnet data**:
  the deposit upsert's `update` clause was resetting `status` to CONFIRMED each poll, which
  downgraded an already-CREDITED deposit and let the next poll credit it again (balance
  doubled). Fixed so the upsert only ever advances the confirmation count; `creditDeposit`
  owns the CREDITED transition. Re-verified: credited exactly once across multiple polls.
- **Admin manual-credit fallback** (`/admin/deposits`): finance-role-gated, creates a
  MANUAL deposit with a synthetic txHash and credits via the same `creditDeposit` path,
  writes an audit log. Verified end-to-end in the browser: 0.5 BTC credit → correct balance,
  one ledger entry, deposit CREDITED, audit row.
- **Known limitations (documented, not hidden)**: the ETH watcher scans native transfers
  only (no ERC-20 tokens — USDT/USDC/LINK need log-based scanning) and uses an in-memory,
  non-reorg-aware checkpoint — fine for testnet, needs hardening before real funds. Real
  withdrawals are Phase 3. The hot-wallet mnemonic is a dev/testnet value in `.env`; production
  must source it from a secrets manager (compliance note in CLAUDE.md still stands).

## 2026-07-10 — Phase 1: Auth & security
- **better-auth 1.6.23** wired up with the Prisma adapter, `username` plugin, and `twoFactor`
  plugin (TOTP + backup codes). Schema for Session/Account/Verification/TwoFactor generated via
  `@better-auth/cli generate` against our hand-written schema and reconciled — the CLI's remote
  fetch worked here (unlike the shadcn CLI in Phase 0).
- **Registration**: email, username, password+confirm, country, phone, referral code, KYC/ToS
  agreement (`src/app/(auth)/register`). Referral code resolution and this user's own generated
  code happen in a `user.create` databaseHook (`src/lib/auth.ts`) — found and fixed a real bug
  here: better-auth silently strips any field from a hook's return value that isn't declared in
  `user.additionalFields`, even if it's a genuine Prisma column, so `referralCode` had to be
  declared there before it would actually reach the database.
- **Email verification** required before login (`requireEmailVerification: true`), auto-signs-in
  on verification. **Login** supports remember-me and a full 2FA step-up flow
  (`twoFactorRedirect` → TOTP code entry). **Forgot/reset password** flow included.
- **2FA settings UI**: enable (password → QR + backup codes → confirm code) and disable
  (password confirm), `src/app/(dashboard)/settings/security/two-factor-section.tsx`.
- **Sessions & login history**: list/revoke active sessions via better-auth's session API;
  `LoginHistory` is a separate append-only table (not the ephemeral `Session` table) written via
  a `session.create` databaseHook, so it survives sign-out/expiry.
- **Anti-phishing code**: custom `User.antiPhishingCode` field, settable via a server action.
- **RBAC**: `src/middleware.ts` does an edge-safe optimistic cookie check only; real
  role/status enforcement is server-side in `src/lib/auth-session.ts`
  (`requireUser`/`requireRole`/`requireAdmin`), since role can't be trusted from a cookie alone.
- Real transactional email is not wired up — verification/reset links are logged to the server
  console (`TODO(Phase 1 follow-up)` markers in `src/lib/auth.ts`). Needs Resend/SendGrid before
  this is usable outside local dev. Google/Apple OAuth login from the spec were **not** built —
  no OAuth app credentials exist yet for either provider.
- **PostgreSQL 16 installed locally via Homebrew** (no bottle for this environment, ~1hr+
  source build) to run a real migration and end-to-end test rather than only type-checking.
  Migration `20260710084207_init` applied; full flow (register → verify → login → enable/verify
  2FA → 2FA-gated login → list/revoke sessions → RBAC on `/admin` vs `/dashboard` → password
  reset request) exercised over real HTTP against the real database — see docs/ERD.md.
- Seed script (`prisma/seed.ts`, `npm run db:seed`) creates a SUPER_ADMIN via the real
  `auth.api.signUpEmail` path (not a raw Prisma insert) so password hashing goes through the
  same code as real users.

## 2026-07-10 — Phase 0: Foundation
- Repo created (`github.com/omolewastephen/tradynance`, private), local git author set to
  `Lewa <omolewastephen@gmail.com>` for this repo only (doesn't touch global git config).
- `CLAUDE.md` written: locked stack, repo layout, hard conventions (ledger-as-source-of-truth
  for balances, no Co-Authored-By trailers, changelog-per-session), 11-phase build plan.
- `docs/DESIGN_SYSTEM.md`: full token system (Space Grotesk / Manrope / JetBrains Mono type
  system, brand color mapping to semantic tokens, spacing/radius/elevation scales, glassmorphism
  scoped to nav/modals only, motion rules). Chosen over the generic Inter-only recommendation
  the design-intelligence skill defaulted to, to avoid the templated-AI look.
- Next.js 15.5.20 scaffolded in `web/` (App Router, TS strict, Tailwind 4, React 19). Bumped
  off the initial 15.5.0 install because of a known CVE (CVE-2025-66478).
- shadcn/ui set up by hand (`components.json`, `cn` helper, Button/Card/Input/Label) — the
  `shadcn` CLI's remote init (`ui.shadcn.com`) isn't reachable from this environment, so
  components were hand-written to the same conventions instead of relying on the CLI fetch.
- Design tokens wired into `globals.css` as Tailwind v4 `@theme` variables (colors, type scale,
  radius, elevation shadows) — dark is the default surface, light overridden via `[data-theme]`.
- Prisma 6.19.3 schema for the core ERD: User/Role/KYC, Asset/AssetNetwork, Wallet,
  LedgerEntry (append-only), Deposit, Withdrawal, Market, Order, Trade, AuditLog. Validated
  with `prisma validate` + `prisma generate`; not yet migrated against a live database.
- No Docker/CI setup yet — deferred per working agreement until the app is worth deploying;
  CI/CD itself is scoped to Phase 11.
