import Link from "next/link";
import type { Metadata } from "next";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { COMPLIANCE_ROLES, SYSTEM_EMAIL } from "@/lib/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KycActions } from "./kyc-actions";

export const metadata: Metadata = { title: "KYC review — Admin — Tradynance" };

export default async function AdminKycPage() {
  await requireRole(COMPLIANCE_ROLES);

  const [pending, recent] = await Promise.all([
    prisma.user.findMany({
      where: { kycStatus: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, username: true, country: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { kycStatus: { in: ["VERIFIED", "REJECTED"] }, email: { not: SYSTEM_EMAIL } },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { id: true, email: true, kycStatus: true, country: true },
    }),
  ]);

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <h1 className="font-display text-h1 tracking-tight">KYC review</h1>

      <Card>
        <CardHeader>
          <CardTitle>Pending verification</CardTitle>
          <CardDescription>
            Document upload isn&apos;t wired yet — review here operates on the KYC status field
            (approve → VERIFIED, reject → REJECTED).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-foreground-muted">Nothing pending.</p>
          ) : (
            <div className="flex flex-col">
              {pending.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle py-3 last:border-0"
                >
                  <div>
                    <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-primary">
                      {u.email}
                    </Link>
                    <div className="text-xs text-foreground-muted">
                      @{u.username} · {u.country ?? "—"} · joined {u.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                  <KycActions userId={u.id} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recently reviewed</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-foreground-muted">Nothing reviewed yet.</p>
          ) : (
            <div className="flex flex-col">
              {recent.map((u) => (
                <div key={u.id} className="flex items-center justify-between border-b border-border-subtle py-2 text-sm last:border-0">
                  <Link href={`/admin/users/${u.id}`} className="hover:text-primary">
                    {u.email}
                  </Link>
                  <span
                    className={
                      "text-xs font-medium " +
                      (u.kycStatus === "VERIFIED" ? "text-primary" : "text-danger")
                    }
                  >
                    {u.kycStatus}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
