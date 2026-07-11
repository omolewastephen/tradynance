import type { Metadata } from "next";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { NotificationsList } from "./notifications-list";

export const metadata: Metadata = { title: "Notifications — Tradynance" };

export default async function NotificationsPage() {
  const session = await requireUser();

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({ where: { userId: session.user.id, read: false } }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl animate-fade-rise flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="text-sm text-foreground-muted">
            {unread > 0 ? `${unread} unread` : "You're all caught up"}
          </p>
        </div>
      </div>

      <NotificationsList
        initialUnread={unread}
        items={notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
