import type { Metadata } from "next";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { COMPLIANCE_ROLES, SYSTEM_EMAIL } from "@/lib/admin";
import { signedDocumentUrl, kycStorageConfigured } from "@/lib/kyc-storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewPanel, type SubmissionRow } from "./review-panel";

export const metadata: Metadata = { title: "KYC review — Admin — Tradynance" };

export default async function AdminKycPage() {
  await requireRole([...COMPLIANCE_ROLES]);

  const [pending, recent] = await Promise.all([
    prisma.kycSubmission.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { email: true, username: true } } },
    }),
    prisma.kycSubmission.findMany({
      where: { status: { in: ["VERIFIED", "REJECTED"] }, user: { email: { not: SYSTEM_EMAIL } } },
      orderBy: { reviewedAt: "desc" },
      take: 15,
      include: { user: { select: { email: true } } },
    }),
  ]);

  // Signed URLs are minted per render and expire in minutes, so document links can't be shared on.
  const rows: SubmissionRow[] = await Promise.all(
    pending.map(async (s) => ({
      id: s.id,
      email: s.user.email,
      username: s.user.username,
      legalName: s.legalName,
      dateOfBirth: s.dateOfBirth.toLocaleDateString(),
      address: `${s.addressLine}, ${s.city} ${s.postalCode}, ${s.country}`,
      documentType: s.documentType,
      documentNumber: s.documentNumber,
      submittedAt: s.createdAt.toLocaleDateString(),
      docs: [
        { label: "Front", url: await signedDocumentUrl(s.frontPath) },
        ...(s.backPath ? [{ label: "Back", url: await signedDocumentUrl(s.backPath) }] : []),
        ...(s.selfiePath ? [{ label: "Selfie", url: await signedDocumentUrl(s.selfiePath) }] : []),
      ],
    })),
  );

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <h1 className="font-display text-h1 tracking-tight">KYC review</h1>

      {!kycStorageConfigured() && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-warning">
              Document storage isn&apos;t configured, so users can&apos;t submit verification yet.
              Set <span className="font-mono">CLOUDINARY_URL</span> (or{" "}
              <span className="font-mono">CLOUDINARY_CLOUD_NAME</span>/
              <span className="font-mono">_API_KEY</span>/<span className="font-mono">_API_SECRET</span>).
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pending verification
            {rows.length > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                {rows.length}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Check that the document is legible, unexpired, and matches the details given. Approving
            enables withdrawals for that user. Rejections require a reason — the applicant sees it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-foreground-muted">Nothing pending.</p>
          ) : (
            <div className="flex flex-col">
              {rows.map((s) => (
                <ReviewPanel key={s.id} submission={s} />
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
            <p className="text-sm text-foreground-muted">No decisions yet.</p>
          ) : (
            <div className="flex flex-col">
              {recent.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle py-2.5 text-sm last:border-0"
                >
                  <span>{s.user.email}</span>
                  <span className="text-xs text-foreground-muted">{s.legalName}</span>
                  <span
                    className={
                      "text-xs font-medium " +
                      (s.status === "VERIFIED" ? "text-primary" : "text-danger")
                    }
                  >
                    {s.status}
                    {s.rejectionReason ? ` · ${s.rejectionReason}` : ""}
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
