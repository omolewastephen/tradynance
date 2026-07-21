"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { COMPLIANCE_ROLES } from "@/lib/admin";
import { notify } from "@tradynance/core";
import type { PrismaClient } from "@tradynance/core";

export type ReviewResult = { ok: true } | { ok: false; error: string };

/**
 * Decide a KYC submission. Writes the outcome to BOTH the submission (the evidence + who decided
 * it, for audit) and User.kycStatus (the fast flag the withdrawal gate reads).
 */
export async function reviewKycSubmission(formData: FormData): Promise<ReviewResult> {
  const session = await requireRole([...COMPLIANCE_ROLES]);

  const submissionId = String(formData.get("submissionId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const rejectionReason = String(formData.get("rejectionReason") ?? "").trim();

  if (decision !== "VERIFIED" && decision !== "REJECTED") {
    return { ok: false, error: "Invalid decision" };
  }
  if (decision === "REJECTED" && rejectionReason.length < 4) {
    // The applicant sees this, and needs to know what to fix.
    return { ok: false, error: "Give a reason so the user knows what to correct." };
  }

  const submission = await prisma.kycSubmission.findUnique({
    where: { id: submissionId },
    select: { id: true, userId: true, status: true },
  });
  if (!submission) return { ok: false, error: "Submission not found" };
  if (submission.status !== "PENDING") {
    return { ok: false, error: "This submission has already been reviewed." };
  }

  await prisma.$transaction([
    prisma.kycSubmission.update({
      where: { id: submissionId },
      data: {
        status: decision,
        rejectionReason: decision === "REJECTED" ? rejectionReason : null,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
    }),
    prisma.user.update({
      where: { id: submission.userId },
      data: { kycStatus: decision },
    }),
  ]);

  await notify(prisma as PrismaClient, {
    userId: submission.userId,
    type: "SYSTEM",
    title: decision === "VERIFIED" ? "Identity verified" : "Identity verification not approved",
    body:
      decision === "VERIFIED"
        ? "Your identity has been verified. Withdrawals are now enabled on your account."
        : `Your verification wasn't approved: ${rejectionReason}. You can submit again from Verification.`,
    referenceType: "KycSubmission",
    referenceId: submissionId,
  });

  await recordAudit({
    actorId: session.user.id,
    action: decision === "VERIFIED" ? "kyc.approve" : "kyc.reject",
    entityType: "KycSubmission",
    entityId: submissionId,
    // No document paths or ID numbers in the audit trail.
    metadata: { userId: submission.userId, decision },
  });

  revalidatePath("/admin/kyc");
  revalidatePath("/settings/kyc");
  return { ok: true };
}
