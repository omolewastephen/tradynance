import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// Liveness/readiness probe for orchestration + load balancers. Checks DB connectivity.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", db: "up", time: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    // TEMPORARY: surface the real DB error to diagnose the Netlify deploy (revert after).
    const err = e as Error;
    return NextResponse.json(
      {
        status: "degraded",
        db: "down",
        error: err?.name ?? "Error",
        detail: (err?.message ?? String(e)).slice(0, 400),
        time: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
