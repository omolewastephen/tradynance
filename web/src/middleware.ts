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
];
const AUTH_PAGES = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (isProtected && !sessionCookie) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));
  if (isAuthPage && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

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
    "/login",
    "/register",
  ],
};
