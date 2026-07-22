import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth-session";
import { uploadKycDocument } from "@/lib/kyc-storage";

/**
 * TEMPORARY DIAGNOSTIC — DELETE AFTER USE.
 *
 * KYC submissions with realistic (~600KB×3) documents hang with no response, while tiny test
 * files work. This route isolates which layer breaks on the production runtime by timing the two
 * suspects independently, via a route handler (a DIFFERENT body-handling path from server
 * actions — if this route works at sizes where the action hangs, the action layer itself is the
 * bug and the fix is to move submission to a route handler):
 *   1. multipart parsing (`req.formData()`)
 *   2. a real Cloudinary upload of the parsed file
 * Admin-only; uploads land under kyc/diag-probe for later cleanup.
 */
export async function POST(req: Request) {
  const session = await getCurrentSession();
  if (!session || session.user.role === "USER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const t0 = Date.now();
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch (err) {
    return NextResponse.json({
      step: "parse",
      error: (err as Error).message,
      tParseMs: Date.now() - t0,
    });
  }
  const tParseMs = Date.now() - t0;

  const f = fd.get("file");
  if (!(f instanceof File) || f.size === 0) {
    return NextResponse.json({ tParseMs, upload: "no file provided" });
  }

  const t1 = Date.now();
  const r = await uploadKycDocument("diag-probe", "front", f);
  return NextResponse.json({
    tParseMs,
    fileBytes: f.size,
    upload: r.ok ? "ok" : `fail: ${r.error}`,
    tUploadMs: Date.now() - t1,
  });
}
