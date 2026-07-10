import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import type { Role } from "@tradynance/core";

const ADMIN_ROLES: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "FINANCE",
  "SUPPORT",
  "COMPLIANCE",
  "MODERATOR",
  "DEVELOPER",
  "AUDITOR",
];

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

// Server-side gate for any /dashboard, /settings, etc. layout — the middleware's
// cookie check is optimistic only; this does the real DB-backed validation.
export async function requireUser() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.status !== "ACTIVE") redirect("/account-suspended");
  return session;
}

export async function requireRole(roles: Role[]) {
  const session = await requireUser();
  if (!roles.includes(session.user.role as Role)) redirect("/dashboard");
  return session;
}

export async function requireAdmin() {
  return requireRole(ADMIN_ROLES);
}
