# Changelog

Dated, newest first. One bullet per change; note *why* when it's not obvious. This is the
skimmable running record — see `git log` for full diffs.

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
