import Link from "next/link";
import type { Metadata } from "next";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { ANY_ADMIN_ROLES } from "@/lib/admin";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Audit log — Admin — Tradynance" };

const PAGE_SIZE = 40;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // Any admin role (incl. read-only AUDITOR) may view the audit trail.
  await requireRole(ANY_ADMIN_ROLES);
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { email: true } } },
    }),
    prisma.auditLog.count(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <div>
        <h1 className="font-display text-h1 tracking-tight">Audit log</h1>
        <p className="text-foreground-muted">
          Append-only record of admin actions — {total} entries. Nothing here is editable or
          deletable.
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-micro uppercase tracking-wide text-foreground-muted">
                <th className="py-3 pl-5 font-medium">When</th>
                <th className="py-3 pr-4 font-medium">Actor</th>
                <th className="py-3 pr-4 font-medium">Action</th>
                <th className="py-3 pr-4 font-medium">Entity</th>
                <th className="py-3 pr-5 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-foreground-muted">
                    No audit entries yet.
                  </td>
                </tr>
              )}
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border-subtle align-top last:border-0">
                  <td className="py-2.5 pl-5 text-xs text-foreground-muted">
                    {e.createdAt.toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 text-xs">{e.actor?.email ?? "system"}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs">{e.action}</td>
                  <td className="py-2.5 pr-4 text-xs text-foreground-muted">
                    {e.entityType}
                    {e.entityId ? (
                      <span className="ml-1 font-mono">{e.entityId.slice(0, 8)}…</span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-5 font-mono text-xs text-foreground-muted">
                    {e.metadata ? JSON.stringify(e.metadata) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/admin/audit?page=${page - 1}`} className="text-accent hover:underline">
              ← Prev
            </Link>
          ) : (
            <span className="opacity-40">← Prev</span>
          )}
          <span className="text-foreground-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={`/admin/audit?page=${page + 1}`} className="text-accent hover:underline">
              Next →
            </Link>
          ) : (
            <span className="opacity-40">Next →</span>
          )}
        </div>
      )}
    </div>
  );
}
