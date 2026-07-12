import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { renderMarkdown } from "@/lib/markdown";
import { nftArtDataUri } from "@/lib/nft-art";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.post.findFirst({ where: { slug, status: "PUBLISHED" } });
  if (!post) return { title: "Post — Tradynance" };
  return { title: `${post.title} — Tradynance`, description: post.excerpt };
}

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await prisma.post.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { author: { select: { displayUsername: true, username: true } } },
  });
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-2xl px-5 py-16">
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> All posts
      </Link>

      <div className="mt-6 flex items-center gap-2 text-xs text-foreground-subtle">
        {post.category && <span className="text-primary">{post.category}</span>}
        {post.category && <span>·</span>}
        <span>{post.publishedAt ? fmtDate(post.publishedAt) : ""}</span>
        <span>·</span>
        <span>{post.author?.displayUsername ?? post.author?.username ?? "Tradynance"}</span>
      </div>

      <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight">{post.title}</h1>
      <p className="mt-4 text-lg text-foreground-muted">{post.excerpt}</p>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={nftArtDataUri(post.coverSeed, 640)}
        alt=""
        className="mt-8 aspect-[16/9] w-full rounded-xl border border-border-subtle object-cover"
      />

      <div
        className="mt-10 flex flex-col gap-4 text-foreground-muted"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
      />
    </article>
  );
}
