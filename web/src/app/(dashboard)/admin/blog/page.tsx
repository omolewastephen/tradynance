import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { CONTENT_ROLES } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { PostRowActions } from "./post-row-actions";

export const metadata: Metadata = { title: "Blog — Admin" };

export default async function AdminBlogPage() {
  await requireRole(CONTENT_ROLES);
  const posts = await prisma.post.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="flex animate-fade-rise flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Blog</h1>
          <p className="text-sm text-foreground-muted">{posts.length} post{posts.length === 1 ? "" : "s"}</p>
        </div>
        <Link
          href="/admin/blog/new"
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" /> New post
        </Link>
      </div>

      <Card className="p-0">
        {posts.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-foreground-muted">No posts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs text-foreground-muted [&>th]:px-4 [&>th]:py-2 [&>th]:font-normal">
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-t [&>tr]:border-border-subtle">
                {posts.map((p) => (
                  <tr key={p.id} className="[&>td]:px-4 [&>td]:py-2.5">
                    <td>
                      <Link href={`/admin/blog/${p.id}`} className="font-medium hover:text-primary">
                        {p.title}
                      </Link>
                    </td>
                    <td className="text-foreground-muted">{p.category ?? "—"}</td>
                    <td>
                      <span
                        className={
                          "rounded-xs px-1.5 py-0.5 text-xs font-medium " +
                          (p.status === "PUBLISHED"
                            ? "bg-primary/10 text-primary"
                            : "bg-border text-foreground-muted")
                        }
                      >
                        {p.status === "PUBLISHED" ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="text-xs text-foreground-muted">{p.updatedAt.toLocaleDateString()}</td>
                    <td className="text-right">
                      <PostRowActions id={p.id} slug={p.slug} status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
