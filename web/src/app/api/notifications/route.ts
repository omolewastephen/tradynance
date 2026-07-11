import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

// Recent notifications + unread count for the current user (the topbar bell polls this).
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ items: [], unread: 0 }, { status: 401 });

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.notification.count({ where: { userId: session.user.id, read: false } }),
  ]);

  return NextResponse.json({
    unread,
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}
