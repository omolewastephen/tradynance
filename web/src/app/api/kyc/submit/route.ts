import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { enforceRateLimit } from "@/lib/rate-limit";
import { uploadKycDocument, kycStorageConfigured } from "@/lib/kyc-storage";

/**
 * KYC submission — deliberately a ROUTE HANDLER, not a server action. On the production runtime
 * (Netlify + Cloudflare) server-action invocations with multipart bodies beyond ~a few hundred KB
 * hang with no response ever arriving, while the identical parse + Cloudinary upload through a
 * route handler completes in ~1s at 2MB (verified with a timing probe on production). Documents
 * are exactly that kind of body, so this endpoint owns the flow. Session comes from the cookie
 * (SameSite=Lax keeps cross-site POSTs cookie-less, so the CSRF posture matches server actions).
 */

const submissionSchema = z.object({
  legalName: z.string().trim().min(2, "Enter your full legal name").max(120),
  dateOfBirth: z.string().trim().min(1, "Enter your date of birth"),
  addressLine: z.string().trim().min(4, "Enter your address").max(200),
  city: z.string().trim().min(1, "Enter your city").max(80),
  postalCode: z.string().trim().min(1, "Enter your postal code").max(20),
  country: z.string().trim().min(2, "Enter your country").max(60),
  documentType: z.enum(["PASSPORT", "NATIONAL_ID", "DRIVERS_LICENSE", "RESIDENCE_PERMIT"]),
  documentNumber: z.string().trim().min(3, "Enter your document number").max(60),
});

/** Must be an adult — a hard requirement for a financial account, not a nicety. */
function isAtLeast18(dob: Date): boolean {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return dob <= cutoff;
}

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session) return bad("Sign in to submit verification.", 401);

  try {
    if (!kycStorageConfigured()) {
      return bad("Identity verification isn't available yet. Please try again later.", 503);
    }

    // Uploading identity documents is expensive and abusable — cap attempts.
    const limited = await enforceRateLimit("kyc:submit", session.user.id, 5, 60 * 60_000);
    if (!limited.ok) return bad(limited.error, 429);

    // Block resubmission while a review is already open, and don't let a verified user re-open.
    const current = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { kycStatus: true },
    });
    if (current.kycStatus === "PENDING") {
      return bad("Your verification is already under review.");
    }
    if (current.kycStatus === "VERIFIED") {
      return bad("Your identity is already verified.");
    }

    const formData = await req.formData();
    const parsed = submissionSchema.safeParse({
      legalName: formData.get("legalName"),
      dateOfBirth: formData.get("dateOfBirth"),
      addressLine: formData.get("addressLine"),
      city: formData.get("city"),
      postalCode: formData.get("postalCode"),
      country: formData.get("country"),
      documentType: formData.get("documentType"),
      documentNumber: formData.get("documentNumber"),
    });
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input");
    const d = parsed.data;

    const dob = new Date(d.dateOfBirth);
    if (Number.isNaN(dob.getTime())) return bad("Enter a valid date of birth");
    if (!isAtLeast18(dob)) return bad("You must be at least 18 years old.");

    const front = formData.get("front");
    const back = formData.get("back");
    const selfie = formData.get("selfie");
    if (!(front instanceof File) || front.size === 0) {
      return bad("Upload the front of your document.");
    }

    const frontUpload = await uploadKycDocument(session.user.id, "front", front);
    if (!frontUpload.ok) return bad(frontUpload.error);

    let backPath: string | null = null;
    if (back instanceof File && back.size > 0) {
      const r = await uploadKycDocument(session.user.id, "back", back);
      if (!r.ok) return bad(r.error);
      backPath = r.path;
    }

    let selfiePath: string | null = null;
    if (selfie instanceof File && selfie.size > 0) {
      const r = await uploadKycDocument(session.user.id, "selfie", selfie);
      if (!r.ok) return bad(r.error);
      selfiePath = r.path;
    }

    await prisma.$transaction([
      prisma.kycSubmission.create({
        data: {
          userId: session.user.id,
          legalName: d.legalName,
          dateOfBirth: dob,
          addressLine: d.addressLine,
          city: d.city,
          postalCode: d.postalCode,
          country: d.country,
          documentType: d.documentType,
          documentNumber: d.documentNumber,
          frontPath: frontUpload.path,
          backPath,
          selfiePath,
          status: "PENDING",
        },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { kycStatus: "PENDING" },
      }),
    ]);

    await recordAudit({
      actorId: session.user.id,
      action: "kyc.submit",
      entityType: "User",
      entityId: session.user.id,
      // Deliberately no document numbers or file paths in the audit metadata.
      metadata: { documentType: d.documentType, country: d.country },
    });

    revalidatePath("/settings/kyc");
    revalidatePath("/admin/kyc");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[kyc] submit threw:", (err as Error).stack ?? (err as Error).message);
    return bad("Something went wrong submitting your verification. Please try again.", 500);
  }
}
