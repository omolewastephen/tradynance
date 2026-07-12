# Tradynance — Design System

Source of truth for visual tokens. Derived via `ui-ux-pro-max` skill search (typography/style
domains, query: fintech/crypto/trading/dashboard) + our fixed brand colors from CLAUDE.md.
Every token here should be expressed as a Tailwind 4 `@theme` variable or CSS custom property —
no raw hex in components.

## Why these choices (anti-AI-ish rationale)
The skill's own default recommendation for "fintech/dark dashboard" is Inter/Inter — that's the
generic choice we're explicitly avoiding. Instead: a three-font system where each font has a
distinct job, matched to what the closest real comparable (`Web3 Bitcoin DeFi` pattern in the
skill's typography database) recommends for crypto-native products. No blanket `rounded-2xl`,
no default shadcn zinc theme unstyled, no drop-shadow-on-everything — elevation in dark mode
comes from border + surface-luminance steps, shadows are a secondary/rare accent.

## Typography

| Role | Font | Weights used |
|---|---|---|
| Display / Headings | **Space Grotesk** | 500, 600, 700 |
| Body / UI | **Manrope** | 400, 500, 600, 700 |
| Data / Mono (prices, balances, hashes, timestamps) | **JetBrains Mono** | 400, 500, 600 |

Space Grotesk carries the "technical/crypto-native" character (distinct geometric letterforms —
not another Inter-alike). Manrope is the UI workhorse: higher x-height and less clinical than
Inter, still excellent at small sizes. JetBrains Mono is mandatory for anything numeric a user
compares at a glance — prices, PnL, balances, wallet addresses, tx hashes, timestamps — with
`font-variant-numeric: tabular-nums` so digits don't jitter as they update.

```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
```

```js
// tailwind theme (v4 @theme block or tailwind.config)
fontFamily: {
  display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui'],
  sans:    ['Manrope', 'ui-sans-serif', 'system-ui'],
  mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular'],
}
```

### Type scale
| Token | Size / Line-height | Tracking | Font | Use |
|---|---|---|---|---|
| `display` | 56px / 1.1 | -0.02em | Space Grotesk 700 | Marketing hero only |
| `h1` | 36px / 1.15 | -0.01em | Space Grotesk 600 | Page titles |
| `h2` | 28px / 1.2 | -0.01em | Space Grotesk 600 | Section headers |
| `h3` | 22px / 1.3 | normal | Space Grotesk 500 | Card/panel titles |
| `h4` | 18px / 1.4 | normal | Manrope 600 | Sub-headers |
| `body-lg` | 16px / 1.6 | normal | Manrope 400 | Marketing copy, forms |
| `body` | 14px / 1.55 | normal | Manrope 400 | Dashboard default text |
| `small` | 13px / 1.5 | normal | Manrope 400/500 | Table cells, secondary |
| `micro` | 11px / 1.4 | +0.04em, uppercase | Manrope 600 | Eyebrows, badges, labels |
| `data` | 14px / 1.4 | normal, tabular-nums | JetBrains Mono 500 | Prices, balances, PnL |
| `data-lg` | 20px / 1.2 | normal, tabular-nums | JetBrains Mono 600 | Hero balance, ticker price |

Rule: mobile form inputs render at ≥16px regardless of the scale above (prevents iOS auto-zoom
on focus) — dashboard density rules don't apply inside `<input>`.

## Color tokens — "Onyx & Emerald" (v2, Phase 13)
Premium dark exchange palette. The deepened emerald keeps the brand identity while the neutral-onyx
surfaces + electric-blue accent + rose "down" read more elegant/professional than the original
slate-blue set. The whole app + marketing site theme off these; source of truth is
`web/src/app/globals.css`. (Original v1 values are in git history.)

```css
:root, [data-theme="dark"] {
  --background: #0A0B0E;         /* onyx, faint cool */
  --surface: #13151C;           /* cards, panels */
  --surface-raised: #1B1E27;    /* popovers, dropdowns, modals */
  --foreground: #F3F5F9;        /* not pure #FFF — avoids halation on near-black */
  --foreground-muted: #99A2B3;
  --foreground-subtle: #626C7B; /* timestamps, tertiary labels */
  --border: rgba(255,255,255,0.08);
  --border-subtle: rgba(255,255,255,0.05);

  --primary: #12D07A;           /* buy / positive / brand — deepened emerald */
  --primary-foreground: #04140A;
  --primary-muted: rgba(18,208,122,0.12); /* tints, active nav */
  --accent: #4C82FB;            /* links, focus ring, secondary actions — electric blue */
  --accent-foreground: #FFFFFF;
  --danger: #F6465D;            /* sell / negative / destructive — rose */
  --danger-foreground: #FFFFFF;
  --warning: #F5A524;
  --warning-foreground: #1A1203;

  --price-up: var(--primary);
  --price-down: var(--danger);
  --ring: var(--accent);

  --gradient-brand: linear-gradient(135deg, #12D07A 0%, #4C82FB 100%); /* logo tile, hero accents */
  --shadow-glow: 0 0 0 1px rgba(18,208,122,.15), 0 8px 30px -6px rgba(18,208,122,.28);
}

/* Utilities in globals.css: .text-gradient-brand, .bg-brand-glow, .bg-grid, .glass */

[data-theme="light"] {
  --background: #FFFFFF;
  --surface: #F7F8FA;
  --surface-raised: #FFFFFF;
  --foreground: #0F172A;
  --foreground-muted: #5B6472;
  --border: rgba(15,23,42,0.08);
  --border-subtle: rgba(15,23,42,0.06);

  --primary: #109A4E;           /* slightly deepened for AA contrast on white */
  --primary-foreground: #FFFFFF;
  --accent: #2563EB;
  --accent-foreground: #FFFFFF;
  --danger: #DC2626;
  --danger-foreground: #FFFFFF;
  --warning: #B45309;
  --warning-foreground: #FFFFFF;
}
```

**Never convey buy/sell, up/down, or status by color alone** — pair with `▲/▼` or `+/−` and a
text label (WCAG color-not-only rule; also just good practice for red/green colorblindness,
which is common enough in a trading user base to matter).

## Spacing scale (4px base unit)
`2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128` — use Tailwind's default scale (already
4px-based); don't invent arbitrary values outside it.

## Radius scale
| Token | Value | Use |
|---|---|---|
| `radius-xs` | 4px | checkboxes, tiny chips |
| `radius-sm` | 8px | buttons, inputs, badges |
| `radius-md` | 12px | cards, panels |
| `radius-lg` | 16px | modals, major elevated surfaces |
| `radius-full` | 9999px | avatars, pills, toggles |

Don't apply `radius-lg` to everything — that blanket-rounded look is exactly the templated
default we're avoiding. Buttons/inputs stay at `sm`; only top-level containers get `md`/`lg`.

## Elevation (dark-first: border + luminance, not drop-shadow)
| Level | Background | Border | Shadow |
|---|---|---|---|
| 0 — page | `--background` | none | none |
| 1 — card | `--surface` | 1px `--border-subtle` | none |
| 2 — popover/dropdown | `--surface-raised` | 1px `--border` | `0 8px 24px -4px rgba(0,0,0,.45)` |
| 3 — modal/sheet | `--surface-raised` | 1px `--border` | `0 24px 64px -12px rgba(0,0,0,.6)` + scrim `rgba(3,4,6,.7)` + `backdrop-blur(6px)` |

Light mode keeps the same level structure; shadows get much softer (`rgba(15,23,42,.04–.12)`)
since white-on-white needs the shadow to do more of the separation work than it does in dark.

## Glassmorphism — scoped, not decorative
Blur/glass effects are allowed **only** on:
1. Sticky top navigation bar
2. Command palette / global search overlay
3. Modal & sheet scrim backdrops

Never on cards, tables, the order book, trade forms, or anything displaying numeric data —
blur behind numbers a trader is scanning at speed actively hurts legibility and contradicts the
whole point of a trading UI. Data surfaces stay opaque, high-contrast, borders crisp.

## Motion
150–300ms for micro-interactions (hover, press, toggle), ease-out on enter / ease-in on exit,
transform+opacity only (never animate width/height/top/left — causes layout thrash). Respect
`prefers-reduced-motion`. Order book row updates and price ticks use a brief (~120ms) flash of
`--price-up`/`--price-down` background at low opacity, not a bounce/scale — data changes should
read as "updated," not "played an animation."

## Icons
SVG only (Lucide), one stroke weight (1.5px) throughout, no emoji as functional icons anywhere
in the product chrome.
