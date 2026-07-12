import "server-only";
import { prisma } from "@/lib/prisma";

// Editable marketing copy. Every key has a code default here, so the public site renders fully
// before anyone touches admin; admin overrides land in the SiteContent table and win. Marketing
// pages call getSiteContent() once and read keys via the returned lookup.
export const SITE_DEFAULTS: Record<string, string> = {
  "home.hero.eyebrow": "The professional crypto exchange",
  "home.hero.title": "Trade digital assets, elevated.",
  "home.hero.subtitle":
    "Spot, futures, staking, and instant convert on one fast, secure platform — built for traders who take markets seriously.",
  "home.hero.ctaPrimary": "Start trading",
  "home.hero.ctaSecondary": "Explore markets",

  "home.features.title": "Everything a serious trader needs",
  "home.features.subtitle":
    "A complete exchange — deep liquidity, real derivatives, and yield — wrapped in an interface that gets out of your way.",

  "home.cta.title": "Ready to trade?",
  "home.cta.subtitle": "Create an account in minutes and fund it in seconds.",
  "home.cta.button": "Create free account",

  "about.title": "Building the exchange we always wanted to trade on",
  "about.lead":
    "Tradynance is a full-stack crypto exchange — spot, margin, futures, staking, and more — engineered around one principle: your money math must never be wrong.",
  "about.body":
    "Every balance on Tradynance is derived from an append-only ledger, not a mutable number in a database. Deposits, trades, funding, liquidations, staking rewards — each is a signed, immutable entry, so the books always reconcile. On top of that foundation we've built the tools active traders actually use: an isolated-margin futures engine with live liquidations, a real order book, instant convert, referral rebates, VIP fee tiers, staking, a launchpad, and an NFT marketplace.\n\nWe obsess over correctness first and speed second — because in markets, a fast wrong number is worse than a slightly slower right one.",
  "about.stat1.value": "16",
  "about.stat1.label": "Assets supported",
  "about.stat2.value": "5.0×",
  "about.stat2.label": "Up to leverage",
  "about.stat3.value": "24/7",
  "about.stat3.label": "Markets open",

  "contact.title": "Talk to us",
  "contact.subtitle":
    "Questions about the platform, partnerships, or your account? Send a message and the team will get back to you.",

  "footer.tagline": "The professional crypto exchange.",
};

export type SiteContent = (key: string) => string;

/** Returns a lookup `sc(key)` that prefers admin overrides, falling back to code defaults. */
export async function getSiteContent(): Promise<SiteContent> {
  const rows = await prisma.siteContent.findMany();
  const overrides = new Map(rows.map((r) => [r.key, r.value]));
  return (key: string) => overrides.get(key) ?? SITE_DEFAULTS[key] ?? "";
}
