import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { CONTENT_ROLES } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { PostEditor } from "../post-editor";

export const metadata: Metadata = { title: "Edit post — Admin" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(CONTENT_ROLES);
  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl animate-fade-rise flex-col gap-4">
      <Link href="/admin/blog" className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Blog
      </Link>
      <h1 className="text-xl font-semibold">Edit post</h1>
      <Card className="p-5">
        <PostEditor
          initial={{
            id: post.id,
            title: post.title,
            category: post.category ?? "",
            excerpt: post.excerpt,
            content: post.content,
            status: post.status,
          }}
        />
      </Card>
    </div>
  );
}
