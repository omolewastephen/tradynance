"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { CONTENT_ROLES } from "@/lib/admin";

const schema = z.object({
  title: z.string().trim().min(3, "Title too short").max(160),
  excerpt: z.string().trim().min(10, "Add a short excerpt").max(400),
  content: z.string().trim().min(20, "Content too short"),
  category: z.string().trim().max(40).optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base: string): Promise<string> {
  const root = base || "post";
  let slug = root;
  for (let i = 2; await prisma.post.findUnique({ where: { slug } }); i++) slug = `${root}-${i}`;
  return slug;
}

export type PostResult = { ok: true; id: string } | { ok: false; error: string };

function parse(formData: FormData) {
  return schema.safeParse({
    title: formData.get("title"),
    excerpt: formData.get("excerpt"),
    content: formData.get("content"),
    category: formData.get("category") || undefined,
    status: formData.get("status"),
  });
}

export async function createPost(formData: FormData): Promise<PostResult> {
  const session = await requireRole(CONTENT_ROLES);
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  const slug = await uniqueSlug(slugify(d.title));
  const post = await prisma.post.create({
    data: {
      title: d.title,
      slug,
      excerpt: d.excerpt,
      content: d.content,
      category: d.category || null,
      coverSeed: `post-${slug}`,
      status: d.status,
      authorId: session.user.id,
      publishedAt: d.status === "PUBLISHED" ? new Date() : null,
    },
  });
  await recordAudit({ actorId: session.user.id, action: "cms.post_create", entityType: "Post", entityId: post.id, metadata: { title: d.title, status: d.status } });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  return { ok: true, id: post.id };
}

export async function updatePost(id: string, formData: FormData): Promise<PostResult> {
  const session = await requireRole(CONTENT_ROLES);
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Post not found" };

  await prisma.post.update({
    where: { id },
    data: {
      title: d.title,
      excerpt: d.excerpt,
      content: d.content,
      category: d.category || null,
      status: d.status,
      // Set publishedAt the first time it goes live; keep the original thereafter.
      publishedAt: d.status === "PUBLISHED" ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
    },
  });
  await recordAudit({ actorId: session.user.id, action: "cms.post_update", entityType: "Post", entityId: id, metadata: { status: d.status } });
  revalidatePath("/admin/blog");
  revalidatePath(`/blog/${existing.slug}`);
  revalidatePath("/blog");
  return { ok: true, id };
}

export async function deletePost(id: string): Promise<{ ok: boolean }> {
  const session = await requireRole(CONTENT_ROLES);
  await prisma.post.delete({ where: { id } }).catch(() => {});
  await recordAudit({ actorId: session.user.id, action: "cms.post_delete", entityType: "Post", entityId: id });
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  return { ok: true };
}
