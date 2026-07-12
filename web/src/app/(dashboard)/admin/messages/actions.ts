"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { CONTENT_ROLES } from "@/lib/admin";

type Status = "NEW" | "READ" | "ARCHIVED";

export async function setMessageStatus(id: string, status: Status): Promise<{ ok: boolean }> {
  await requireRole(CONTENT_ROLES);
  await prisma.contactMessage.update({ where: { id }, data: { status } });
  revalidatePath("/admin/messages");
  return { ok: true };
}
