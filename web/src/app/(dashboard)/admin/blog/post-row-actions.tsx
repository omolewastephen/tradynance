"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { deletePost } from "./actions";

export function PostRowActions({ id, slug, status }: { id: string; slug: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center justify-end gap-3 text-xs">
      {status === "PUBLISHED" && (
        <Link href={`/blog/${slug}`} target="_blank" className="text-accent hover:underline">
          View
        </Link>
      )}
      <Link href={`/admin/blog/${id}`} className="text-foreground-muted hover:text-foreground">
        Edit
      </Link>
      <button
        onClick={() => {
          if (!confirm("Delete this post? This can't be undone.")) return;
          start(async () => {
            await deletePost(id);
            router.refresh();
          });
        }}
        disabled={pending}
        className="text-foreground-muted transition-colors hover:text-danger disabled:opacity-50"
      >
        {pending ? "…" : "Delete"}
      </button>
    </div>
  );
}
