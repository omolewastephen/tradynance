import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { requireRole } from "@/lib/auth-session";
import { CONTENT_ROLES } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { PostEditor } from "../post-editor";

export const metadata: Metadata = { title: "New post — Admin" };

export default async function NewPostPage() {
  await requireRole(CONTENT_ROLES);
  return (
    <div className="mx-auto flex w-full max-w-3xl animate-fade-rise flex-col gap-4">
      <Link href="/admin/blog" className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> Blog
      </Link>
      <h1 className="text-xl font-semibold">New post</h1>
      <Card className="p-5">
        <PostEditor initial={{ title: "", category: "", excerpt: "", content: "", status: "DRAFT" }} />
      </Card>
    </div>
  );
}
