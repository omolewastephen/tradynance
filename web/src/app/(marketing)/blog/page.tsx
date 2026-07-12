import Link from "next/link";
import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { nftArtDataUri } from "@/lib/nft-art";

export const metadata: Metadata = { title: "Blog — Tradynance" };

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function BlogPage() {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });

  return (
    <div className="mx-auto max-w-6xl px-5 py-20">
      <div className="max-w-2xl">
        <span className="text-micro font-medium uppercase tracking-wide text-primary">Blog</span>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Insights & updates</h1>
        <p className="mt-3 text-foreground-muted">
          Product news, market thinking, and notes from building Tradynance.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="mt-12 rounded-xl border border-border-subtle bg-surface p-12 text-center text-foreground-muted">
          No posts published yet — check back soon.
        </div>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/blog/${p.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface transition-colors hover:border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={nftArtDataUri(p.coverSeed)} alt="" className="aspect-[16/9] w-full object-cover" />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center gap-2 text-xs text-foreground-subtle">
                  {p.category && <span className="text-primary">{p.category}</span>}
                  {p.category && <span>·</span>}
                  <span>{p.publishedAt ? fmtDate(p.publishedAt) : ""}</span>
                </div>
                <h2 className="mt-2 font-display text-lg font-semibold leading-snug transition-colors group-hover:text-primary">
                  {p.title}
                </h2>
                <p className="mt-1.5 line-clamp-3 flex-1 text-sm text-foreground-muted">{p.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
