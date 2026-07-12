import type { Metadata } from "next";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { CONTENT_ROLES } from "@/lib/admin";
import { SITE_DEFAULTS } from "@/lib/site-content";
import { ContentEditor } from "./content-editor";

export const metadata: Metadata = { title: "Site content — Admin" };

export default async function ContentPage() {
  await requireRole(CONTENT_ROLES);

  const overrides = new Map((await prisma.siteContent.findMany()).map((r) => [r.key, r.value]));
  // Current value = override or default, for every known key.
  const values: Record<string, string> = {};
  for (const key of Object.keys(SITE_DEFAULTS)) values[key] = overrides.get(key) ?? SITE_DEFAULTS[key];

  return (
    <div className="mx-auto flex w-full max-w-2xl animate-fade-rise flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Site content</h1>
        <p className="text-sm text-foreground-muted">
          Edit the marketing site copy. Blank/unchanged fields fall back to defaults.
        </p>
      </div>
      <ContentEditor values={values} />
    </div>
  );
}
