import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES, SYSTEM_EMAIL } from "@/lib/admin";

/**
 * Typeahead for admin forms that target a user (e.g. manual deposit credit). Finance-gated —
 * it reveals user emails, so it gets exactly the same role wall as the pages that use it.
 */
export async function GET(req: Request) {
  const session = await getCurrentSession();
  if (!session || !(FINANCE_ROLES as string[]).includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 1) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      email: { not: SYSTEM_EMAIL },
      OR: [{ email: { contains: q } }, { username: { contains: q, mode: "insensitive" } }],
    },
    select: { id: true, email: true, username: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return NextResponse.json({ users });
}
