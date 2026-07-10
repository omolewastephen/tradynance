# Changelog

Dated, newest first. One bullet per change; note *why* when it's not obvious. This is the
skimmable running record — see `git log` for full diffs.

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
