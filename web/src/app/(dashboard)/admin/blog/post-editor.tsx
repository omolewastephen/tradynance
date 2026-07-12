"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPost, updatePost } from "./actions";

export type PostInitial = {
  id?: string;
  title: string;
  category: string;
  excerpt: string;
  content: string;
  status: "DRAFT" | "PUBLISHED";
};

export function PostEditor({ initial }: { initial: PostInitial }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">(initial.status);

  function onSubmit(formData: FormData) {
    setError(null);
    formData.set("status", status);
    start(async () => {
      const res = initial.id ? await updatePost(initial.id, formData) : await createPost(formData);
      if (res.ok) router.push("/admin/blog");
      else setError(res.error);
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={initial.title} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <Input id="category" name="category" defaultValue={initial.category} placeholder="e.g. Product" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="excerpt">Excerpt</Label>
        <textarea
          id="excerpt"
          name="excerpt"
          rows={2}
          defaultValue={initial.excerpt}
          required
          className="rounded-sm border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-primary/50"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="content">Content (markdown)</Label>
        <textarea
          id="content"
          name="content"
          rows={16}
          defaultValue={initial.content}
          required
          className="rounded-sm border border-border bg-surface-raised px-3 py-2 font-mono text-sm leading-relaxed outline-none focus:border-primary/50"
        />
        <p className="text-xs text-foreground-muted">
          Supports # headings, **bold**, *italic*, `code`, - lists, and [links](https://…).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-sm border border-border-subtle p-1">
          {(["DRAFT", "PUBLISHED"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-xs px-3 py-1.5 text-sm transition-colors",
                status === s ? "bg-primary/15 text-primary" : "text-foreground-muted hover:text-foreground",
              )}
            >
              {s === "DRAFT" ? "Draft" : "Published"}
            </button>
          ))}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : initial.id ? "Save changes" : "Create post"}
        </button>
        <button type="button" onClick={() => router.push("/admin/blog")} className="text-sm text-foreground-muted hover:text-foreground">
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
