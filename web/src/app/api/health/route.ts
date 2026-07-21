import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { emailTransport } from "@/lib/email";
import { kycStorageConfigured } from "@/lib/kyc-storage";

// Liveness/readiness probe for orchestration + load balancers. Checks DB connectivity, and reports
// which optional subsystems are actually wired in this deployment. Both extras are names/booleans,
// never credentials — they exist because their failure mode is silent (email falls back to console
// and still reports success; KYC uploads are refused) and otherwise needs log-diving to spot.
export async function GET() {
  const subsystems = { email: emailTransport(), kycStorage: kycStorageConfigured() };
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", db: "up", ...subsystems, time: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "down", ...subsystems, time: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
