import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES, SYSTEM_EMAIL } from "@/lib/admin";
import { Card } from "@/components/ui/card";
import { Prisma } from "@tradynance/core";

export const metadata: Metadata = { title: "Users — Admin — Tradynance" };

const PAGE_SIZE = 25;

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "text-primary",
  SUSPENDED: "text-warning",
  FROZEN: "text-warning",
  BANNED: "text-danger",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireRole(USER_ADMIN_ROLES);
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.UserWhereInput = {
    email: { not: SYSTEM_EMAIL },
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        kycStatus: true,
        country: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 tracking-tight">Users</h1>
          <p className="text-foreground-muted">{total} users</p>
        </div>
        <form className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-muted" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search email or username"
            className="h-10 w-64 rounded-sm border border-border bg-surface pl-9 pr-3 text-sm text-foreground outline-none focus-visible:border-ring"
          />
        </form>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-micro uppercase tracking-wide text-foreground-muted">
                <th className="py-3 pl-5 font-medium">User</th>
                <th className="py-3 pr-4 font-medium">Role</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 pr-4 font-medium">KYC</th>
                <th className="py-3 pr-4 font-medium">Country</th>
                <th className="py-3 pr-5 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-foreground-muted">
                    No users match.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border-subtle last:border-0 hover:bg-surface-raised/50">
                  <td className="py-3 pl-5">
                    <Link href={`/admin/users/${u.id}`} className="flex flex-col hover:text-primary">
                      <span className="font-medium">{u.email}</span>
                      <span className="text-xs text-foreground-muted">@{u.username}</span>
                    </Link>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">{u.role}</td>
                  <td className={"py-3 pr-4 text-xs font-medium " + (STATUS_COLOR[u.status] ?? "")}>
                    {u.status}
                  </td>
                  <td className="py-3 pr-4 text-xs text-foreground-muted">{u.kycStatus}</td>
                  <td className="py-3 pr-4 text-xs text-foreground-muted">{u.country ?? "—"}</td>
                  <td className="py-3 pr-5 text-xs text-foreground-muted">
                    {u.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <PageLink q={q} page={page - 1} disabled={page <= 1} label="← Prev" />
          <span className="text-foreground-muted">
            Page {page} of {pages}
          </span>
          <PageLink q={q} page={page + 1} disabled={page >= pages} label="Next →" />
        </div>
      )}
    </div>
  );
}

function PageLink({
  q,
  page,
  disabled,
  label,
}: {
  q?: string;
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) return <span className="text-foreground-muted opacity-40">{label}</span>;
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  return (
    <Link href={`/admin/users?${params}`} className="text-accent hover:underline">
      {label}
    </Link>
  );
}
