import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic, edge-safe check only (cookie presence, no DB call / role check).
// Real authorization (role, status, session validity) is enforced server-side
// in each protected layout/page via `requireUser` / `requireRole` — see
// src/lib/auth-session.ts. This just avoids a flash of protected UI for
// signed-out users and redirects obviously-unauthenticated requests early.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/portfolio",
  "/admin",
  "/settings",
  "/wallet",
  "/withdraw",
  "/markets",
  "/trade",
  "/convert",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isProtected && !sessionCookie) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // NOTE: we intentionally do NOT redirect /login → /dashboard here on cookie *presence*. The
  // cookie check is optimistic (edge, no DB), so a stale/invalid session cookie would bounce
  // /login → /dashboard → (requireUser redirects back) → /login forever — the exact loop that hit
  // Chrome (which held an old cookie) while Safari (clean) was fine. The login/register pages do a
  // real getSession() check and redirect valid sessions to /dashboard instead.

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/portfolio/:path*",
    "/admin/:path*",
    "/settings/:path*",
    "/wallet/:path*",
    "/withdraw/:path*",
    "/markets/:path*",
    "/trade/:path*",
    "/convert/:path*",
  ],
};
