"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { CONTENT_ROLES } from "@/lib/admin";
import { SITE_DEFAULTS } from "@/lib/site-content";

// Save edited marketing copy. For each known key: if the value differs from the code default we
// store an override; if it matches the default we drop any override (revert to default). Keeps the
// SiteContent table to only genuine overrides.
export async function saveSiteContent(formData: FormData): Promise<{ ok: boolean }> {
  const session = await requireRole(CONTENT_ROLES);

  let changed = 0;
  for (const key of Object.keys(SITE_DEFAULTS)) {
    const raw = formData.get(key);
    const value = typeof raw === "string" ? raw : "";
    if (value === SITE_DEFAULTS[key]) {
      await prisma.siteContent.deleteMany({ where: { key } });
    } else {
      await prisma.siteContent.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
      changed++;
    }
  }

  await recordAudit({ actorId: session.user.id, action: "cms.content_update", entityType: "SiteContent", metadata: { overrides: changed } });
  revalidatePath("/", "layout"); // marketing pages read this copy
  revalidatePath("/admin/content");
  return { ok: true };
}
