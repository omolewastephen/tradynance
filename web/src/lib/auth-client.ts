"use client";

import { createAuthClient } from "better-auth/react";
import {
  usernameClient,
  twoFactorClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";

import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  // Call auth on the SAME origin the app is actually served from — never a hardcoded URL. A fixed
  // baseURL breaks every other origin (127.0.0.1, a LAN IP, a deployed domain): the browser sends
  // the login request cross-origin, the CSP `connect-src 'self'` blocks it, no session cookie lands
  // on the real origin, and every protected route 307s back to /login (the "login ↔ dashboard
  // loop"). In the browser we use window.location.origin; the SSR fallback is never used for real
  // requests (those fire from browser event handlers). See [[auth-boundary-hard-navigation]].
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [
    usernameClient(),
    twoFactorClient(),
    inferAdditionalFields<typeof auth>(),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
