# Tradynance — ERD (Phase 0)

Source of truth is `web/prisma/schema.prisma`; this is a navigable summary, not a duplicate —
update the schema first, then reflect changes here.

## Entities

**User** — identity + role (`Role` enum covers admin roles from CLAUDE.md's spec: SUPER_ADMIN,
ADMIN, FINANCE, SUPPORT, COMPLIANCE, MODERATOR, DEVELOPER, AUDITOR, plus USER) + status +
KYC status + self-referential referral tree. Auth-provider tables (Account/Session/Verification)
are added in Phase 1 via better-auth, then reconciled against this model.

**Asset** → **AssetNetwork** — a coin (BTC, ETH, USDT...) and the chains it can move on, each
with its own min-deposit/withdrawal-fee/memo-requirement.

**Wallet** — one row per (user, asset, network). `balance` / `lockedBalance` are **cached**,
derived from `LedgerEntry` — never mutated directly (see money-correctness invariant in the
schema header and CLAUDE.md hard convention #3).

**LedgerEntry** — append-only. Every credit/debit (deposit, withdrawal, trade fill, fee,
transfer, conversion, manual adjustment) is one row here, signed amount + balance snapshot.
No update/delete from application code; corrections are new entries.

**Deposit** / **Withdrawal** — user-facing request/tracking records with their own status
workflow (pending → confirmed/approved → credited/completed, or rejected). On completion they
produce a `LedgerEntry`.

**Market** — a trading pair (base/quote asset), precision + fee config.

**Order** → **Trade** — spot order book. An `Order` is user intent (side, type, TIF, price,
quantity, fill progress); a `Trade` is one match between a buy order and a sell order at a
price/quantity, fees captured per side.

**AuditLog** — append-only action log (actor, action, entity, metadata, IP). Nothing here is
ever deletable, per CLAUDE.md admin requirements.

## Relationships (high level)
```
User ─┬─< Wallet >─┬─ Asset ─< AssetNetwork
      ├─< LedgerEntry
      ├─< Deposit
      ├─< Withdrawal
      ├─< Order >─< Trade >─ Market ─ Asset (base/quote)
      └─< AuditLog (as actor)
```

## Deliberately deferred to later phases
- Margin/futures positions, leverage, liquidation (Phase 9)
- Staking, referral commissions/levels, VIP tiers, launchpad, NFT (Phase 10)
- Notification records, support tickets (Phase 10/11)
- Auth-provider tables — better-auth generates these in Phase 1

## Verification status
Schema validated with `npx prisma validate` and `npx prisma generate` (Prisma 6.19.3) — both
passed. Not yet migrated against a live Postgres instance; that happens when `DATABASE_URL`
points at a real database (`npx prisma migrate dev --name init`).
