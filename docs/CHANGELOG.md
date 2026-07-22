# Changelog

Dated, newest first. One bullet per change; note *why* when it's not obvious. This is the
skimmable running record — see `git log` for full diffs.

## 2026-07-22 — KYC submissions actually work now (server-action multipart hang); skeleton loaders
- **User-reported "error" on /settings/kyc, root-caused in three layers.** The page itself was
  fine — the failure was submissions with *real* documents. My original E2E passed with 70-byte
  test images; realistic phone photos (3–6MB each) made the submit **hang forever with no
  response** — no error, no timeout, spinner indefinitely.
- **Layer 1 — client compression** (`kyc-form.tsx`): document photos are downscaled to 1600px JPEG
  in the browser before upload (3.91MB → ~600KB, verified in-browser). Text stays perfectly
  legible; PDFs can't be recompressed so a clear pre-submit total-size check (4.5MB) rejects them
  with instructions instead of hanging.
- **Layer 2 — the real bug: server-action multipart transport.** Even compressed (1.75MB total),
  the action POST never received a response. Isolated with a temporary timing route on production:
  through a **route handler** the identical parse + Cloudinary upload completes in ~1s at 2MB, at
  every size tried. The server-action invocation path (Netlify runtime + Cloudflare) is what hangs
  on non-tiny multipart bodies. **Fix: KYC submission moved to `POST /api/kyc/submit`** (same
  validations, rate limit, transaction, audit; CSRF posture unchanged — the session cookie is
  SameSite=Lax). Verified live: a 1.8MB three-document submission returns `{"ok":true}` and lands
  PENDING with all three files on Cloudinary. Diagnostic route deleted after use.
- **Layer 3 — silent client failure:** the form awaited the action inside `startTransition` with no
  catch, so a transport failure produced *nothing* — no error, no state change. The fetch now has
  an explicit catch with a human message.
- **Skeleton loaders across the board** (user request): `ui/skeleton.tsx` + route-group
  `loading.tsx` for the dashboard (covers every user + admin page in one file — App Router shows it
  instantly during any server render) and the marketing site. Shaped like the real page anatomy so
  content swap is calm, `aria-busy` for screen readers.
- Test artifacts fully cleaned: probe user + every Cloudinary test asset deleted (verified by
  direct fetch → 404; the admin listing API caches and may lag).

## 2026-07-22 — Dashboard audit (user + admin): design, a11y, and a real perf fix
- **Raw enums no longer leak into the UI**: new `ui/status-pill.tsx` renders humanized statuses
  ("Super Admin", "Verified") as pills with an icon + tint — icon alongside color per WCAG
  color-not-only. `SUPER_ADMIN` / `VERIFIED` in mono caps was implementation detail shown to users.
- **User overview is now an exchange overview**: live top-5 markets (reuses the shared Ticker query,
  server-rendered, rows link to each market) + the user's 5 most recent ledger entries with signed
  colored amounts, replacing the dead space. The KYC tile is actionable ("Verify now →" when
  unverified/rejected, "Under review" when pending, "Withdrawals enabled" when verified); the
  fund-your-account card only shows when the balance is actually $0; welcome line uses the username
  rather than raw email.
- **Admin queue tiles alert when non-empty**: pending KYC/deposits/withdrawals get a warning border,
  warning-colored count, and an explicit "Needs review →" cue when > 0 — an ops dashboard's job is
  to make non-empty queues impossible to miss. Zero-count tiles stay neutral. (Alert state is
  logic-verified; not screenshotted — queues were genuinely empty and I wasn't going to fabricate
  pending rows in production to pose one.)
- **Perf: admin trade volume is now a SQL aggregate** (`SUM(price*quantity)` via `$queryRaw`). It
  previously `findMany`'d **every trade row ever** and reduced in JS — an unbounded scan growing
  with every fill.
- A11y: `scope="col"` on the admin users table headers; balance-hero eye toggle got a ~32px hit
  area (padding, not visual size), focus ring, and `aria-pressed`.
- Verified live: new overview + admin render in production, 0px mobile overflow, /dashboard 2.36 kB.

## 2026-07-22 — Auth a11y/UX pass (measured, fixed, re-verified live)
- **Mobile horizontal overflow fixed** (user-reported): measured 98px of overflow at 390px — the
  form column is a grid item, and grid items default to `min-width:auto`, so it refused to shrink
  below the no-wrap ticker strip's intrinsic ~448px and pushed the whole page wide; the strip's own
  `overflow-x-auto` never engaged. `min-w-0` on both grid columns; re-measured **0px** on login and
  register.
- **Accessibility audit of the live pages, then fixes, then re-audit:** errors are now announced
  (`role="alert"` on server + field errors, `aria-invalid`/`aria-describedby` wiring), submit CTAs
  are 44px touch targets, validation runs on blur (`mode:"onTouched"`) instead of submit-only,
  register shows the password rules as persistent hint text (matching the zod schema) rather than
  only as errors, and the decorative panel headline demoted h2→p so the form's h1 tops the outline.
- **Password show/hide toggle** (`ui/password-input.tsx`) on all three password fields — a real
  focusable button with `aria-label`/`aria-pressed`.
- **Register hydration gate added** — login had it but register didn't: pre-hydration a submit
  falls back to a native GET, putting the password in the URL (history + server logs). Same guard
  both forms now. Also stacked register's paired fields on phones (`grid-cols-1 sm:grid-cols-2`).
- Submit buttons get a spinner + brand glow; cost of the whole pass ≈ +0.8kB per page.
- Verified live post-deploy: 0px overflow, 44px CTAs, toggles work (type flips to text), on-blur
  inline error announced, headings H1-only, hint present.

## 2026-07-22 — Auth redesign, brand favicon, KYC verified end-to-end
- **Login & register redesigned** into a split-screen shell (`(auth)/layout.tsx`): a graphical brand
  panel (gradient headline, trust points, and a **live market list from the real Ticker cache** with
  factual asset/market counts — no fabricated volume) beside a clean, focused form. One ticker query
  is shared by the desktop panel and the mobile strip. Fully responsive: the panel is desktop-only,
  mobile gets the logo, form (top-aligned for thumb reach) and a horizontal live strip. Server-
  rendered tickers + CSS effects keep it fast — no chart libs, minimal client JS. Verified by
  screenshot in **light and dark**, desktop and mobile, on both pages.
- **Fixed a real logo bug found during review:** `LogoMark` used a fixed gradient id, so with two
  logos in the DOM (the `hidden lg:flex` panel + the mobile bar) every `url(#id)` resolved to the
  first — which sits in a `display:none` container and never paints — blanking the visible mark on
  mobile. Now a per-instance id via `useId`. Fixes the class of bug anywhere the logo repeats.
- **KYC verified end-to-end in production** (submit → private Cloudinary storage → admin signed-link
  review → approve → withdrawal unlock). The submit had 500'd: `kyc-storage.ts` used the **global**
  `crypto.randomUUID()`, absent in Netlify's function runtime even on Node 20, and outside the
  try/catch → unhandled. Switched to `import { randomUUID } from "node:crypto"` (the convention every
  other action already follows). Also verified the Cloudinary path directly first (private upload,
  signed-URL read, public-URL blocked, cleanup) before touching production.
- **Favicon is the Tradynance mark**, not the Next scaffold default: generated `favicon.ico`
  (16/32/48), `icon.svg`, and `apple-icon.png` from the brand logo via sharp; removed the leftover
  `vercel.svg`/`next.svg`/etc. Confirmed live (served bytes changed).

## 2026-07-21 — Fix: production sent no email at all; KYC documents moved to Cloudinary
- **Registration and reset emails were never being sent.** `/api/health` now reports the active
  transport, which showed `email: "smtp"`: `SMTP_HOST` was set in Netlify but neither HTTP key was,
  so every send took the SMTP path — **blocked on Lambda** — and failed. Confirmed against Resend's
  API: the account had received *zero* application emails, ever. Fixed by setting `RESEND_API_KEY`
  in Netlify; verified a real reset arriving (`delivered`) and a real signup verification too.
- **Netlify env vars need a redeploy to reach functions.** Setting them isn't enough — this cost
  time twice (Supabase, then Resend). Noted here so it isn't rediscovered a third time.
- **`/api/health` now reports subsystems** (`email` transport name, `kycStorage` boolean). Both
  fail *silently* otherwise — the email chain ends in a console fallback that returns success, so
  the app cheerfully reports "sent" while dropping everything. A missing transport now also logs an
  error in production. Names and booleans only, never credentials.
- **KYC documents now live on Cloudinary**, not Supabase Storage (the bucket rejected every upload).
  Uploaded as **`type: "private"`** — Cloudinary's *default* upload type is publicly readable by
  anyone with the URL, which is unacceptable for identity documents. Private assets have no public
  delivery URL; admins read them via `private_download_url`, signed and expiring in 300s. Dropped
  `@supabase/supabase-js` (KYC was its only consumer).
- Checked and dismissed: 502s + a stuck login button seen during testing were **deploy turbulence**,
  not a defect. On a settled site the login form hydrates in ~0.5s with no failed requests.
- Known, unfixed: the CSP blocks Cloudflare's injected analytics beacon
  (`static.cloudflareinsights.com`), so Cloudflare Web Analytics records nothing. Left alone
  deliberately — better to disable the injection in Cloudflare than to loosen the CSP.

## 2026-07-21 — KYC verification (real submissions, private document storage, withdrawal gate)
- **KYC was a status flag with nothing behind it.** Admins could set `kycStatus`, but no user could
  ever *become* `PENDING` and there was no name/DOB/document to review — so `/admin/kyc` was
  structurally incapable of ever having a queue. Added the missing half.
- **`KycSubmission` model + `KycDocumentType` enum** (migration `20260721140116_kyc_submissions`):
  identity fields, three document paths, status, rejection reason, reviewer + timestamp. Kept
  separate from `User.kycStatus` on purpose — the submission is the *evidence and audit trail*,
  `kycStatus` is the fast flag the withdrawal gate reads.
- **`/settings/kyc`** (nav: "Verification") — submit legal name, DOB, address, document type/number
  and front/back/selfie uploads. Shows current status and, when rejected, **the reason**, so the
  user knows what to fix. Enforces 18+, blocks resubmission while `PENDING`, rate-limited.
- **Private document storage** (`src/lib/kyc-storage.ts`, Supabase Storage): uploads go through the
  server with the service-role key (never reaches the browser); the bucket is private and admins
  read via **300s signed URLs**, so a forwarded link dies; object paths carry a random UUID so they
  aren't guessable even if a user id leaks. Requires `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` — **without them the feature reports itself unconfigured rather than
  failing silently**, in both the user form and the admin page.
- **Admin review** (`/admin/kyc` rewritten + `actions.ts`): shows the evidence with signed document
  links; **rejection requires a reason** (≥4 chars) because the applicant sees it; the decision
  writes submission + `User.kycStatus` in one transaction, notifies the user, and is audit-logged
  **without document numbers or storage paths**.
- **Withdrawals now require `VERIFIED`**, enforced server-side in the withdrawal action — not merely
  hidden in the UI — because that's the point where value actually leaves the platform.
- **Not compliance.** This collects and stores identity documents; it does *not* verify document
  authenticity, do liveness/selfie matching, or screen sanctions/PEP lists. It also means the
  platform now holds sensitive PII and needs a retention/deletion policy. See CLAUDE.md: KYC/AML
  posture is the operator's responsibility, not something this repo solves in code.
- Raised `serverActions.bodySizeLimit` to 8mb (6MB per document + form overhead).

## 2026-07-21 — Homepage redesign, admin CRUD for launchpad/NFT, dev-copy purge, chart hardening
- **Homepage rebuilt** with framer-motion (`components/motion/reveal.tsx`): `LazyMotion` + `m` to
  keep the bundle at ~15kB rather than ~40kB, `viewport.once` so reveals don't re-fire, and a plain
  `<div>` passthrough under `prefers-reduced-motion`. Hero, live market strip, stats, features,
  steps, security, CTA.
- **Stats deliberately exclude a volume figure.** The ticker volume we mirror is the *reference
  market's*, not ours; showing it would imply otherwise. Only claims true of this platform.
- **Stripped development copy leaking to users** — placeholder/TODO text visible in the live UI.
- **Removed unsafe seeded deposit addresses**: the seed shipped a Bitcoin spec test-vector address
  and the **ETH burn address** as live "sample" deposit addresses. Anything sent to them was
  unrecoverable. Cleared from the seed and from the production DB.
- **Admin CRUD for staking / launchpad / NFTs**, with safety rails over destructive edits: staking
  products holding positions are deactivated, never deleted; launchpad allocation can't drop below
  `soldAllocation` and projects with commitments can't be deleted; collections holding NFTs can't
  be deleted.
- **Change-password UI** in Settings → Security (revokes other sessions by default).
- **Chart hardening**: candle fetch no longer waits on the chart-library import (they run in
  parallel), and chart creation is wrapped so a failed chunk surfaces an error instead of a
  permanent "Loading chart…".

## 2026-07-20 — Production deploy: Netlify + Supabase + Railway workers; email actually delivers
- **Email fixed — root cause was serverless, not the provider.** Zoho SMTP was configured correctly
  and verified working from a local send, but **Netlify/Vercel run on AWS Lambda, which blocks
  outbound SMTP (465/587)**, so a valid config silently failed in production. `email.ts` now prefers
  **HTTP transports** — ZeptoMail → Resend → SMTP → console — and the ordering is documented in
  `.env.example` so this isn't rediscovered later.
- Reverted the lazy `import("@/lib/email")` added for the seed fix: dynamic imports didn't reliably
  resolve inside Netlify's bundled function, so emails vanished with no error. `email.ts` dropped
  `import "server-only"` instead, which fixes the seed *and* keeps the import static.
- **Prisma on Lambda**: added `rhel-openssl-3.0.x`/`1.0.x` binary targets *and*
  `@prisma/nextjs-monorepo-workaround-plugin` + `outputFileTracingIncludes` — the targets alone
  weren't enough, the bundler wasn't copying the query engine, which surfaced as `db:down`.
- **Railway runs the 5 background services** (market-data, market-maker, liquidation-engine,
  sweeper, chain-watcher) via `concurrently`. Netlify can't host them — they're long-running and
  stateful. Removed `healthcheckPath` from `railway.json`: workers expose no HTTP server, so the
  healthcheck failed every deploy. **One replica only** — duplicates would double market-maker
  orders and accrue funding twice.
- Supabase pooled URL (6543, `pgbouncer=true&connection_limit=1`) for runtime, direct URL (5432) as
  Prisma `directUrl` for migrations.

## 2026-07-19 — Remove blog; seed BTC/ETH sample deposit addresses; fix seed
- **Removed the blog** (marketing `/blog` + admin `/admin/blog` + `seed-cms.ts` + the blog-only
  `markdown.ts`, plus the nav/header/footer links). Marketing-only content, not core; restorable
  from git history. `Post` model left in the schema (harmless; dropping it would need a migration).
- **Deposit addresses for all coins:** `AssetNetwork.depositAddress` is admin-settable per network
  (Admin → Assets) for every coin. The seed now pre-fills **sample** addresses for **BTC**
  (BTC_TESTNET) and **ETH** (ETH_SEPOLIA) only; every other coin is blank for the admin to fill.
  Re-seed won't clobber an admin-set address.
- **Fixed the seed** (`prisma db seed`): it imports `auth`, which eagerly imported `email.ts`
  (`import "server-only"`) and threw under tsx (no bundler) — a deploy blocker since seeding runs
  after migrate. `auth.ts` now lazy-imports email inside its callbacks, so importing `auth` from a
  plain-Node context no longer pulls `server-only`. Verified: full seed runs clean; BTC/ETH get
  sample addresses, others null.

## 2026-07-19 — Fix: login↔dashboard loop when app opened on a non-localhost origin
- **Root cause (two layers):** the browser auth client hardcoded
  `baseURL: NEXT_PUBLIC_APP_URL` (`localhost:3000`). Opened on *any other* origin — `127.0.0.1`, a
  **LAN IP** (the dev server prints one), or a deployed domain — the login POST went cross-origin to
  `localhost:3000`, and (1) the CSP `connect-src 'self'` **blocked** it, or once same-origin, (2)
  better-auth returned **403** because `trustedOrigins` defaults to just `BETTER_AUTH_URL`. Either
  way no session landed on the real origin, so every protected route 307'd back to `/login` — the
  "goes to dashboard, bounces to login, loops, then 307" the user saw.
- **Fix:** auth client now calls its **own origin** (`window.location.origin`) instead of a fixed
  URL, so login is same-origin (CSP-allowed) from wherever the app is served. Added
  **`trustedOrigins`** to the server auth: production trusts the configured domains
  (`BETTER_AUTH_URL`/`NEXT_PUBLIC_APP_URL`), development also trusts the request's own origin (so a
  LAN IP / 127.0.0.1 / another device on your network works). Null-safe (better-auth calls it
  without a request in some paths).
- **Second root cause — the "works in Safari, not Chrome" loop:** the middleware optimistically
  redirected `/login` → `/dashboard` whenever a session *cookie was present* (edge check, no DB
  validation). A **stale/invalid** cookie (which Chrome had accumulated from the earlier broken
  attempts, while Safari's jar was clean) then looped forever: `/dashboard` → `requireUser()` finds
  the session invalid → `/login` → middleware sees the cookie → `/dashboard` → … (Chrome:
  `ERR_TOO_MANY_REDIRECTS`). **Fix:** middleware no longer bounces auth pages on cookie presence;
  the login/register pages do a **real `getSession()`** check and redirect only genuinely valid
  sessions. A stale cookie now lands cleanly on `/login` and self-heals on the next login.
- **Hardening:** the login submit button is disabled until the form hydrates — before hydration a
  click fell back to a native GET, putting the password in the URL (history + logs).
- **Verified:** 4/4 logins → `/dashboard` from both `localhost` and `127.0.0.1`; an invalid cookie →
  `/dashboard` now does exactly 1 redirect → `/login` (was infinite / `ERR_TOO_MANY_REDIRECTS`) and
  self-heals on fresh login; a valid session still auto-redirects `/login` → `/dashboard`. Typecheck
  + lint clean.
- **Note (not a code bug):** "market-data failing fetch" is `data-api.binance.vision` being
  **unreachable from the host** (Binance geo/network block — ping timed out here). The app degrades
  (klines proxy → 502, `/api/markets` serves cached DB tickers). Point `MARKET_DATA_API_URL` at a
  source reachable from your region if Binance is blocked.

## 2026-07-19 — Fix: login sometimes stuck on /login (dashboard "307")
- **Root cause:** the login form did `router.push(next)` immediately followed by `router.refresh()`.
  Across the logged-out→logged-in boundary that races — the refresh can cancel the soft navigation
  or serve a stale logged-out router-cache entry for `/dashboard`, so the user stayed on `/login`
  and any direct hit to a protected route bounced back with a 307 (the normal no-session redirect).
  Intermittent, which is why it looked like "the dashboard is broken."
- **Fix:** cross the auth boundary with a **hard navigation** (`window.location.assign`) in both the
  credential and TOTP paths, guaranteeing every server component (layouts, the dashboard's
  `requireUser`) re-renders with the just-set session cookie. Same hardening applied to **sign-out**.
- Also **sanitised the `next` redirect target** (must be a same-origin relative path) — it came
  straight from the query string, so `?next=//evil.com` was an open-redirect risk. Removed an
  unused `headers` import (lint warning).
- **Verified:** 5/5 fresh browser logins now land on `/dashboard` (was intermittently stuck before);
  full route smoke test green; typecheck + lint clean.

## 2026-07-14 — Auto-match: on-chain verification of deposit claims
- **Obvious claims verify themselves.** New `packages/core/src/chain/verify.ts`
  (`verifyDepositTx`, viem-isolated in the chain subpath): given a claim's txid + the deposit
  address shown + the claimed amount, it asks the chain whether that exact transfer happened —
  BTC testnet via esplora, ETH Sepolia via viem. Returns a typed outcome (`verified` /
  `amount_short` / `address_mismatch` / `not_found` / `unsupported` / `error`).
- **At claim time** (verifiable networks only), a match flips the claim `PENDING → CONFIRMED` and
  records live confirmations, so it reaches the admin **pre-verified**. **In the admin queue**, a
  verified claim shows a green **"⛓ Chain-verified · N conf"** badge (one-click approve); unverified
  ones get a **Re-check** button (`recheckDepositClaim`) for claims submitted before the tx
  confirmed. Approval still credits through the same idempotent `creditDeposit` path.
- **Non-chain coins are untouched** (explicit requirement): `verifyDepositTx`/`isVerifiableNetwork`
  return `unsupported` for anything but the two integrated testnets, so those claims skip
  verification entirely and stay the plain manual "Approve & credit" flow — they show a neutral
  "Manual review" tag, no auto-verify, no confirmation change.
- **Verified:** 8/8 core assertions against **live BTC testnet** data (exact→verified w/ real
  confirmations, over-claim→amount_short, wrong-addr→address_mismatch, fake txid→not_found,
  synthetic/non-chain→unsupported); full in-app E2E with a real testnet tx behind a centralized
  admin address — claim auto-verified (50 confs) → green badge → approve credited once
  (0.05→0.0509028, DEPOSIT ledger row, conservation holds). Typecheck green.

## 2026-07-13 — Deposit claims: user "I've paid" → admin approve/reject queue
- **Traceability for the centralized-address deposit model.** With a shared admin-set address,
  the chain can't tell you *which* user paid — so after sending, a user now submits a deposit
  **claim** (amount + transaction ID + sending address) from the deposit page. It creates a
  `PENDING` / `source=CLAIM` `Deposit` (new `DepositSource.CLAIM` enum value + migration),
  rate-limited (8 / 10 min) and audited, with a unique-txid guard (one transfer = one deposit).
- **Admin → Deposits** gained a **"Deposit claims — awaiting review"** queue (badge count, oldest
  first) showing user + amount + network + txid + sender. **Approve & credit** runs the same
  idempotent `creditDeposit` ledger path as the watcher/manual-credit; **Reject** marks it
  `REJECTED` and notifies the user. Both audited (`deposit.claim_approve` / `_reject`). Real
  chain deposits stay in the separate pending table (queue filters `source=CLAIM`).
- Reworded the deposit-page copy from chain-first to the manual/centralized model.
- **Verified end-to-end in the browser + DB:** claim → approve credits exactly once (balance
  0→0.05, DEPOSIT ledger row with matching `balanceAfter` — conservation holds — deposit
  `CREDITED`, "Deposit credited" notification); claim → reject leaves the balance untouched,
  marks `REJECTED`, notifies. Typecheck + production build green.
  *Impl note:* the queue buttons use `<form action>` (the codebase's proven server-action pattern);
  an `onClick`-invoked server action silently failed to dispatch — see [[nextjs-server-action-form-not-onclick]].

## 2026-07-13 — Light/dark theme toggle + app-shell polish
- **Light + dark mode**, user-switchable. A pre-paint inline script in the root layout resolves the
  theme before hydration (saved choice → OS `prefers-color-scheme` → dark default) so there's no
  flash; a dependency-free `ThemeToggle` (sun/moon, in the topbar) flips `data-theme` and persists
  to localStorage. Both palettes already existed as `[data-theme]` tokens — this wires the switch.
- **Collapsible admin nav** (chosen option): the sidebar's "Admin" section is now a collapsible
  group, **collapsed by default** (keeps the operator's own account nav front-and-centre), state
  persisted per-section; a small dot hints when you're on an admin page while it's collapsed.
- **Sidebar/topbar polish:** active routes get a left accent bar + emerald pill (Linear/Vercel
  idiom), refined icon/hover states, smooth grid-rows collapse animation.
- Verified in-browser both themes (login→dashboard→admin), toggle + persistence across navigation,
  system-preference default, and **zero console/hydration errors**; production build green, First
  Load JS unchanged (103 kB).

## 2026-07-13 — Deploy target: Netlify + Supabase + Zoho
- **Supabase-ready Postgres:** added `directUrl` to the Prisma datasource — `DATABASE_URL` is the
  app/runtime connection (on Supabase: the pooled Supavisor URL, 6543, `?pgbouncer=true` — needed
  because serverless functions each open a connection) and `DIRECT_URL` is the migrations connection
  (Supabase direct, 5432; the pooler can't run DDL). Off Supabase both are the same value; set in
  every env template (local `.env`, `.env.example`, `.env.docker.example`, `render.yaml`).
- **Zoho email:** `src/lib/email.ts` now has an **SMTP transport** (nodemailer) that takes
  precedence when `SMTP_HOST` is set (Zoho Mail / ZeptoMail / any SMTP), with the existing Resend
  HTTP path and console fallback after it. New `SMTP_*` env vars.
- **Netlify hosting:** `netlify.toml` (root-based build so npm workspaces resolves `packages/core`;
  `publish=web/.next`; Node 20) + `output:standalone` auto-disabled on Netlify (keyed off `NETLIFY`)
  so Netlify's Next runtime bundles the serverless functions. `docs/DEPLOY.md` gained a full
  **Netlify + Supabase + Zoho** section — incl. the hard truth that Netlify (serverless) **can't run
  the 5 background services**, which must live on one small always-on host (PM2 `--only` the
  services) against the same Supabase + Upstash Redis.
- **Verified:** `prisma validate`/`generate`/`migrate status` green with `directUrl`; production
  build green with standalone still emitted locally (NETLIFY unset); typecheck/lint green; the SMTP
  send path exercised against a local catcher (EHLO→MAIL→RCPT→DATA delivered, messageId returned).
  Not verifiable from here: an actual Netlify deploy and a real Zoho relay (needs the account).

## 2026-07-12 — Redis-backed rate limiting (multi-replica safe)
- **App-level limiter** (`src/lib/rate-limit.ts`, withdrawals/orders/contact) is now backed by a
  **shared Redis sliding-window** (atomic Lua over a sorted set) when `REDIS_URL` is set, with the
  in-process limiter as the fallback (single node) and a fail-open-to-local on a Redis blip. New
  `src/lib/redis.ts` (lazy ioredis singleton). Call sites updated to `await`.
- **Auth limiter** now uses better-auth **`storage: "database"`** (new `RateLimit` model +
  migration) so `/api/auth/*` brute-force limits are shared across replicas too — chosen over Redis
  secondaryStorage specifically so it doesn't disturb session storage or the LoginHistory hook.
- Together these make it safe to run **multiple web replicas**. `.env.example` documents `REDIS_URL`.
- **Verified** end to end: the Lua sliding-window (limit 3/60s → 3 ok, 4th+ denied with retry-after,
  key auto-expires); the live app with Redis — `/api/auth/sign-in` 6× → `429` via the DB store (and
  the `RateLimit` table populated), and a contact submit wrote `rl:contact:submit:*` to Redis;
  production build + typecheck + lint green; local dev falls back to in-process (REDIS_URL unset).

## 2026-07-12 — Deployability: Docker, security headers, health check
- **Dockerised the whole stack**: multi-stage `Dockerfile` (a lean Next.js **standalone** web
  runner + a full-workspace image that runs any service via tsx) and `docker-compose.yml`
  (postgres + redis + a one-shot **migrate/seed** job + web + all five services), `.dockerignore`,
  `.env.docker.example`. `docs/DEPLOY.md` is the runbook. CI now **builds both Docker targets** to
  validate the images.
- **Production security headers** (`web/next.config.ts`): a Next-App-Router-compatible **CSP** plus
  HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Permissions-Policy`. `output: "standalone"` + `outputFileTracingRoot` for a minimal image.
- **`/api/health`** — DB-ping liveness/readiness probe (used by the compose healthcheck).
- **One-click managed hosting**: a **Render blueprint** (`render.yaml` — provisions Postgres + Redis
  + web + all 5 worker services in one file) and a **Railway** config (`railway.json` + a documented
  multi-service setup in DEPLOY.md). Both run the always-on services (unlike Vercel/Netlify).
- **Non-Docker path too** (Docker is optional): `npm run build` (`scripts/build-standalone.sh` —
  standalone output + static/public copied in), `npm run start:web`, and a **PM2**
  `ecosystem.config.cjs` (dependency-free `.env` loader) running web + all five services; systemd
  noted as an alternative. Verified: build produces a runnable standalone; ecosystem parses; a
  service runs via the repo-root tsx path PM2 uses.
- **Verified** by running the real production **standalone server**: `/api/health` → `db: up`, all
  six security headers present, home/login 200, and a full **browser login → dashboard with the CSP
  active and zero console errors**. Surfaced the key deploy gotcha (now documented): the CSP's
  `connect-src 'self'` requires `BETTER_AUTH_URL`/`NEXT_PUBLIC_APP_URL` to **exactly match the
  serving origin** — a host/port mismatch blocks the auth client.

## 2026-07-12 — Deposit sweeper + hot-wallet collision fix
- **Fixed a real custody bug**: the withdrawal hot wallet derived at addressIndex 0, which
  **collided with the first user's deposit address** (deposit indexes also start at 0). The
  treasury/hot wallet now derives on a **reserved BIP-44 account** (`m/44'/60'/1'/0/0`), completely
  separate from user deposit addresses (account 0) — no overlap possible. (Old colliding address
  `0x2cd1…939d` → treasury `0x38c1…23AE`.)
- **Deposit sweeper** (`packages/core/src/chain/sweep.ts` + `services/sweeper`): consolidates
  ETH_SEPOLIA deposits sitting on per-user derived addresses into the treasury (which also pays
  withdrawals), closing the custody loop. For each funded deposit address it re-derives the key,
  sanity-checks it controls the address, and sweeps `balance − gas` to the treasury. **Sweeping
  writes NO LedgerEntry** — the user was already credited at deposit time — so the money invariant
  is untouched; each move is recorded as a `Sweep` row (migration `..._sweep`) for the audit trail.
  Standalone service runs every 5 min; wired into `npm run dev`. BTC sweeping deferred (UTXO/PSBT).
- **`/admin/treasury`**: treasury address, live on-chain balance (best-effort, timeout-guarded),
  the reserved-account note, and recent sweeps — added to the admin nav.
- **Verified**: `sweep-check.ts` — treasury is valid + **doesn't collide with any user deposit
  index**, and the sweep scans ETH_SEPOLIA deposit addresses (swept 0 in dev, no funded addresses).
  Sweeper service boots; treasury page renders (live 0 ETH balance), no console errors. Live sweeps
  need funded testnet deposit addresses. TESTNET ONLY.

## 2026-07-12 — Admin: asset addresses, holdings, transactions (+ futures fix)
- **Fixed `/futures/[symbol]`** (and any core-importing page): Phase 12b re-exported the viem chain
  modules from the `@tradynance/core` barrel, so viem→`ox`'s dynamic require ("Critical dependency:
  the request of a dependency is an expression") leaked into those route bundles and errored before
  load. Moved chain code to a `@tradynance/core/chain` subpath (package `exports` map); the barrel
  no longer pulls in viem. Futures now compiles with zero warnings and renders.
- **Admin asset addresses** — new `AssetNetwork.depositAddress`/`depositMemo` (migration
  `..._asset_deposit_address`) + `/admin/assets`: per coin/network, an admin sets the **platform
  deposit address** (+ memo, min deposit, withdrawal fee, requires-memo, active). When set, the
  user deposit page shows THAT address instead of the per-user derived one (shared-custodial model).
  Verified end-to-end: an admin-set address appears on the user's deposit page.
- **Admin holdings** — `/admin/holdings`: platform total custody + per-asset totals (holders, USD)
  and a table of **every user's balances** (balance / available / USD value, linked to the user).
- **Admin transactions** — `/admin/transactions`: the full append-only **ledger** across the
  platform, paginated, filterable by user email + entry type, with signed/coloured amounts and
  running balance. Per-user "View all transactions" link added to the user detail page.
- Wired Holdings / Transactions / Assets into the admin nav; RBAC-gated + audit-logged.

## 2026-07-12 — Phase 13: Design uplift + marketing site + CMS
- **Design system v2 "Onyx & Emerald"** (13a): overhauled the CSS-variable palette to a premium
  dark-exchange look — onyx surfaces (#0A0B0E/#13151C), deepened emerald (#12D07A), electric-blue
  accent (#4C82FB), rose "down" (#F6465D), a foreground-subtle token, refined elevation + glow, a
  brand gradient. Because every component themes off the vars, the whole app changed in one move.
  New **gradient logo tile** (emerald→blue, ascending bars) — far more visible. Premium utilities
  (`text-gradient-brand`, `bg-brand-glow`, `bg-grid`, `glass`). DESIGN_SYSTEM.md → v2.
- **Public marketing site** (13b): new `(marketing)` route group + header/footer. `/` now serves a
  real homepage (gradient hero, **live ticker strip** from real DB tickers, feature grid, CTA);
  `/about`, `/contact` (form → `ContactMessage`, IP rate-limited), `/blog` + `/blog/[slug]`
  (DB-driven, generative gradient covers, dependency-free markdown renderer). Copy is CMS-editable
  via `lib/site-content.ts` (code defaults + admin overrides). 3 sample posts seeded.
- **Admin CMS** (13c): `Post` / `ContactMessage` / `SiteContent` models (migration `..._cms`).
  `/admin/blog` (full CRUD, draft/publish, slugs, markdown), `/admin/messages` (contact inbox),
  `/admin/content` (edit all marketing copy). RBAC via `CONTENT_ROLES`, audit-logged; wired into
  the admin nav — "wired up into the admin for full management."
- **Verified**: production build green (First Load JS 103 kB / middleware 33 kB unchanged; all
  marketing + CMS routes compiled); browser E2E of homepage, blog, contact submission → admin
  inbox, admin blog manager, and the content editor — no console errors.
- **Note (answering a user question):** deposits are mapped to a **unique per-user address** but are
  **not yet swept** into a central Tradynance wallet — and the withdrawal hot-wallet index (0)
  currently collides with the first user's deposit index. Both are the **deposit-sweeper** track,
  queued next.

## 2026-07-12 — Phase 12c: Pay-from-your-wallet (web3 deposits)
- **`components/web3/pay-with-wallet.tsx`** — on an ETH_SEPOLIA deposit page, connect a browser
  (EIP-1193 / injected, e.g. MetaMask) wallet and send the deposit straight to your custodial
  deposit address on Sepolia. Handles connect / wrong-chain switch / send, shows the tx hash; the
  chain-watcher then credits it through the same idempotent `creditDeposit` path — a nicer funding
  UX, not a new money path.
- **Pure viem, not wagmi** — `wagmi`'s connector barrel fails to build (its `tempo` connector
  imports an unresolvable `accounts` module), so this uses viem + `window.ethereum` directly:
  lighter, buildable, and viem was already a dependency. Loaded via a `dynamic(ssr:false)` client
  loader so the web3 code is a **route-isolated async chunk** — First Load JS (103 kB) and
  middleware (33 kB) are unchanged, and the deposit route grows only ~2 kB.
- **Deferred**: WalletConnect mobile/QR (add `@walletconnect/ethereum-provider` behind
  `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and feed its provider into the same viem client) and SIWE
  web3 **login** (auth-security-sensitive; not attempted without a wallet to exercise it).
- **Verified**: production build green + bundle-isolated; deposit page renders the card and
  **degrades gracefully** with no wallet extension ("No browser wallet detected"), no console
  errors. `.env.example` documents `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

## 2026-07-12 — Phase 12b: On-chain withdrawal broadcast (ETH Sepolia testnet)
- **`packages/core/src/chain/`** — real on-chain settlement of approved withdrawals. `evm-withdraw.ts`
  signs a native-ETH transfer from the custodial **hot wallet** (a dedicated index of the same
  `HD_WALLET_MNEMONIC`) and broadcasts it via the Sepolia RPC (viem), returning the real tx hash;
  `broadcast.ts` dispatches per-network and falls back to `{ broadcast: false }` for chains without
  an implementation (BTC UTXO/PSBT deferred).
- **Admin approve is now real** — previously it just recorded an admin-pasted hash. Now: leave the
  hash blank → for a broadcastable network it signs + broadcasts **first** (funds stay locked),
  persists the real hash, then settles the ledger — so we never debit without a confirmed send, and
  never leave a sent-but-unrecorded withdrawal; broadcast failure (e.g. unfunded hot wallet) touches
  nothing. Pasting a hash keeps the manual path (BTC / out-of-band). Broadcast/settle errors report
  to Sentry. Admin UI hint updated.
- **Verified** (`scripts/broadcast-check.ts`): hot-account derivation deterministic + valid
  (`0x2cd1…939d`), BTC routes to manual fallback, and a live Sepolia send **reaches the chain and is
  rejected only for insufficient funds** — proving signer→RPC→chain end to end. Fund the hot wallet
  with Sepolia ETH to complete a live broadcast. (Not in `test:core`/CI — it needs the mnemonic +
  network.) `.env.example` documents `HOT_WALLET_INDEX`.

## 2026-07-12 — Phase 12a: Real transactional email
- **`web/src/lib/email.ts`** — env-gated mailer: with `RESEND_API_KEY` set it sends via Resend's
  HTTP API (no SDK dependency, just `fetch`); without one it logs to the console exactly as before,
  so reset / verification / withdrawal-OTP flows stay testable end to end in dev. Same "wired but
  inert until you supply the credential" pattern as the Sentry work.
- **Branded HTML template** (inline styles for email-client compatibility) + three helpers
  (password reset, email verification, withdrawal OTP). Transactional emails include the user's
  **anti-phishing code** so recipients can trust them.
- Replaced the three `console.log` stubs (`auth.ts` reset + verification, `withdrawal.ts` OTP) with
  real sends; `.env.example` documents `RESEND_API_KEY` / `EMAIL_FROM`.
- **Also fixed** a rate-limit rule that keyed the wrong path (`/forget-password` → the real
  `/request-password-reset`), so the reset-spam limit actually applies.
- **Verified**: `request-password-reset` → the mailer fired via better-auth's flow, rendered the
  branded template with the reset link + anti-phishing code (console fallback, no key set);
  reset-spam limit confirmed (3 → 200, 4th → 429).

## 2026-07-12 — Phase 11d: CI/CD (GitHub Actions)
- **`.github/workflows/ci.yml`** — on push to master + every PR: spins a Postgres 16 service,
  `npm ci`, `prisma generate` + `migrate deploy`, seeds, then runs **typecheck → lint → core money
  tests → web build**. Concurrency-cancels superseded runs.
- **Made the suite CI-runnable** — two obstacles solved: (1) `futures`/`convert` tests need a mark
  price (normally from the live market-data service) → new create-only **`seed-tickers.ts`** gives
  every market a static fallback price (also benefits local dev: prices before market-data's first
  poll; wired into the main seed); (2) the market-maker's resting liquidity crosses the trading
  test's own orders → **`seed-ci.ts`** seeds assets + markets + tickers only (no market-maker, no
  demo data — each test makes its own).
- **Root scripts**: `typecheck` (web + core + all four services), `lint`, `test:core`
  (`scripts/test-core.sh` runs all 9 suites, fails on any), `db:seed:ci`.
- **Verified locally** (each CI step): `npm ci`, prisma generate/migrate, `db:seed:ci`,
  `typecheck` (exit 0 across 6 workspaces), `lint` (exit 0), `test:core` (**9/9 suites**), `build`
  (green). Closes Phase 11 — the platform is feature-complete through the build plan.

## 2026-07-12 — Phase 11c: Monitoring (Sentry)
- **Error monitoring via `@sentry/nextjs`, fully env-gated** — inert (no network, no overhead)
  until `SENTRY_DSN` is set, so dev and DSN-less deploys are unaffected. Server errors init +
  capture in `src/instrumentation.ts` (`register` → `sentry.server.config.ts`, plus
  `onRequestError` for route handlers / RSC / server actions); `src/lib/observability.ts` gives
  app code a `captureException` / `captureMessage` seam (always logs, forwards to Sentry); a
  top-level `app/global-error.tsx` boundary reports client crashes.
- **Kept the bundle lean** — the naive wiring added ~82 kB to *every* page's First Load JS and
  tripled the middleware bundle (Sentry leaking into the client + edge runtimes). Fixed by: (1)
  no always-on client SDK — the error boundary imports Sentry **lazily** (a chunk loaded only on a
  crash), and (2) a positive `NEXT_RUNTIME === "nodejs"` guard so Sentry is dead-code-eliminated
  from the edge/middleware bundle. Result: First Load JS **103 kB** (unchanged) and middleware
  **33 kB** (unchanged from baseline), vs 184 kB / 116 kB with the naive wiring.
- Wired `captureException` into the previously-silent best-effort referral-settlement catches
  (spot + futures) so swallowed errors surface. `.env.example` documents `SENTRY_DSN` /
  `NEXT_PUBLIC_SENTRY_DSN` (+ a `REDIS_URL` note for multi-instance rate limiting).
- **Verified**: full production build green; app boots with instrumentation compiled and Sentry
  inert (no DSN); `/login` 200, no errors.

## 2026-07-12 — Phase 11b: Audit trail completeness
- **Shared audit helper** `web/src/lib/audit.ts` — `recordAudit({ actorId, action, entityType,
  entityId, metadata })` writes the append-only `AuditLog` and **captures the actor's IP** from
  request headers; never throws into the caller (an audit failure can't break the action).
- **Filled the gaps** — previously only admin actions were logged. Now user-initiated security &
  money-lifecycle events are too: `withdrawal.request` / `.confirm` / `.cancel`,
  `security.anti_phishing_update`, `security.whitelist_add` / `_remove` / `_only`. The existing
  admin actions (user status/role/KYC/2FA, deposit manual-credit, withdrawal approve/reject) were
  refactored onto the same helper so they now capture IP too.
- **Verified**: drove the anti-phishing update through the browser → one `AuditLog` row
  (`security.anti_phishing_update`, entity `User`, `ipAddress ::1`), no console errors.

## 2026-07-12 — Phase 11a: Rate limiting
- **Auth surface**: enabled better-auth's built-in rate limiter (`enabled: true` — on in dev too),
  100 req/60s/IP baseline with stricter custom rules: sign-in 5/60s, sign-up 5/300s,
  forget/reset-password 3–5/300s, TOTP + backup-code verify 5/60s. Guards `/api/auth/*` against
  brute force. Memory storage suits the single node; documented database/Redis for multi-instance.
- **Sensitive server actions**: `web/src/lib/rate-limit.ts` — a dependency-free in-process
  sliding-window limiter (with periodic sweep + client-IP helper), applied to `requestWithdrawal`
  (5/min/user), `confirmWithdrawal` (8 per 5 min — the OTP/TOTP brute-force surface), and
  `submitOrder` (40/10s burst). Interface is swap-ready for a shared Redis store when scaling out.
- **Verified**: 6 rapid `/api/auth/sign-in/email` POSTs → attempts 1–5 `401`, 6th+ `429`.

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
