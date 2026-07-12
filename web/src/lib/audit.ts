import "server-only";

import type { Prisma } from "@tradynance/core";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rate-limit";

// One place to write the append-only AuditLog, capturing the actor's IP from request headers.
// Used by admin actions AND user-initiated security/money events so the trail is complete
// (CLAUDE.md: nothing here is ever deletable). Never throws into the caller — an audit failure
// must not break the action it's recording.
export async function recordAudit(params: {
  actorId?: string | null;
  action: string; // dotted verb, e.g. "withdrawal.request", "security.whitelist_add"
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    const ip = await clientIp().catch(() => "unknown");
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? undefined,
        metadata: params.metadata,
        ipAddress: ip && ip !== "unknown" ? ip : undefined,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record", params.action, (err as Error).message);
  }
}
