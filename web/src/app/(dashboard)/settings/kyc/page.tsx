import type { Metadata } from "next";
import { CheckCircle2, Clock, ShieldAlert, XCircle } from "lucide-react";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KycForm } from "./kyc-form";

export const metadata: Metadata = { title: "Identity verification — Tradynance" };

const STATE = {
  VERIFIED: {
    icon: CheckCircle2,
    tone: "text-primary",
    title: "Your identity is verified",
    body: "You have full access, including withdrawals.",
  },
  PENDING: {
    icon: Clock,
    tone: "text-warning",
    title: "Verification under review",
    body: "Our compliance team is reviewing your documents. This usually takes 1–2 business days.",
  },
  REJECTED: {
    icon: XCircle,
    tone: "text-danger",
    title: "Verification was not approved",
    body: "Please review the reason below and submit again with clearer documents.",
  },
  UNVERIFIED: {
    icon: ShieldAlert,
    tone: "text-foreground-muted",
    title: "Verify your identity",
    body: "Verification is required before you can withdraw funds.",
  },
} as const;

export default async function KycPage() {
  const session = await requireUser();

  const [user, latest] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { kycStatus: true },
    }),
    prisma.kycSubmission.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { status: true, rejectionReason: true, createdAt: true, reviewedAt: true },
    }),
  ]);

  const status = (user.kycStatus ?? "UNVERIFIED") as keyof typeof STATE;
  const s = STATE[status] ?? STATE.UNVERIFIED;
  const Icon = s.icon;
  const canSubmit = status === "UNVERIFIED" || status === "REJECTED";

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <h1 className="font-display text-h1">Identity verification</h1>

      <Card>
        <CardContent className="flex items-start gap-4 pt-6">
          <Icon className={`mt-0.5 size-6 shrink-0 ${s.tone}`} />
          <div>
            <p className="font-medium">{s.title}</p>
            <p className="mt-1 text-sm text-foreground-muted">{s.body}</p>
            {latest?.status === "REJECTED" && latest.rejectionReason && (
              <p className="mt-3 rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                Reason: {latest.rejectionReason}
              </p>
            )}
            {latest && (
              <p className="mt-2 text-xs text-foreground-subtle">
                Submitted {latest.createdAt.toLocaleDateString()}
                {latest.reviewedAt ? ` · reviewed ${latest.reviewedAt.toLocaleDateString()}` : ""}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {canSubmit && (
        <Card>
          <CardHeader>
            <CardTitle>Submit your documents</CardTitle>
            <CardDescription>
              Provide details exactly as they appear on your government-issued document. Everything
              you upload is stored privately and used solely to verify your identity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <KycForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
