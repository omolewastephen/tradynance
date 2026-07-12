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
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "down", time: new Date().toISOString() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
