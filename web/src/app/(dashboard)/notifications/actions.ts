"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  const session = await requireUser();
  // Scope by userId so a user can only touch their own notifications.
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { read: true },
  });
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const session = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });
  revalidatePath("/notifications");
  return { ok: true };
}
