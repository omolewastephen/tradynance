import { prisma } from "../src/lib/prisma";

// Sample blog posts (idempotent by slug), authored by the admin, so the marketing blog + homepage
// have real content out of the box. Editable/removable from the admin CMS.
const POSTS = [
  {
    slug: "why-append-only-ledger",
    title: "Why every balance on Tradynance is derived, never stored",
    category: "Engineering",
    excerpt:
      "A mutable balance field is a bug waiting to happen. Here's how an append-only ledger keeps the books correct — always.",
    coverSeed: "post-ledger-01",
    content:
      "On most early-stage exchanges, your balance is a number in a row that code adds to and subtracts from. It works — until two things happen at once, a retry fires twice, or an exception lands mid-update. Then the number is wrong, and you can't tell what it *should* be.\n\n## The ledger invariant\n\nTradynance never stores a balance as the source of truth. Every credit and debit — deposits, trades, fees, funding, liquidations, staking rewards — is a signed, immutable `LedgerEntry`. Your balance is *derived* from those entries (and cached for speed, reconciled against the ledger).\n\n- Every money movement writes exactly one ledger entry, in the same transaction that updates the cache.\n- Nothing is ever updated or deleted — corrections are new, reversing entries.\n- The books always reconcile, because they're the sum of an append-only log.\n\n## Why it matters to you\n\nIt means a fast wrong number can't slip through. Conservation is checked in tests for every money path. Your balance is the truth, provably.",
  },
  {
    slug: "isolated-margin-futures-live",
    title: "Isolated-margin futures, with a real liquidation engine",
    category: "Product",
    excerpt:
      "Perpetuals up to 5×, live PnL, funding, and a standalone engine that marks and liquidates positions in real time.",
    coverSeed: "post-futures-02",
    content:
      "Futures are only as good as their risk engine. We built ours to be correct first and fast second.\n\n## What's live\n\n- Open long or short with a leverage slider and see your liquidation price before you commit.\n- Positions mark to the live price with continuously-updating PnL and ROE.\n- A standalone liquidation engine force-closes positions that breach maintenance margin, and accrues funding on schedule.\n- Isolated margin means the most you can lose on a position is its margin — never more.\n\n## Correctness, verified\n\nThe whole thing is backed by a pure, tested core: PnL, equity, and liquidation-price math are unit-tested, and settlement conserves value down to the ledger entry.",
  },
  {
    slug: "earn-with-staking",
    title: "Put idle assets to work with staking",
    category: "Product",
    excerpt: "Flexible and fixed-term products with continuously-accruing yield, redeemable on your terms.",
    coverSeed: "post-staking-03",
    content:
      "Holding an asset you're not trading? Stake it.\n\n## Continuously accruing\n\nRewards accrue by the second — no waiting for a daily batch. Flexible products can be redeemed anytime; fixed-term products pay a higher rate and unlock at the end of the term.\n\n## Same money discipline\n\nStaking runs on the same append-only ledger as everything else: your principal moves out of your spot wallet as a signed entry and returns — with the earned yield — when you redeem.",
  },
];

export async function seedCms() {
  const admin = await prisma.user.findUnique({ where: { email: "admin@tradynance.local" } });
  let created = 0;
  for (const p of POSTS) {
    const exists = await prisma.post.findUnique({ where: { slug: p.slug } });
    if (exists) continue;
    await prisma.post.create({
      data: {
        ...p,
        status: "PUBLISHED",
        publishedAt: new Date(),
        authorId: admin?.id,
      },
    });
    created++;
  }
  console.log(`[seed] cms: ${created} blog posts (${POSTS.length} total)`);
}
