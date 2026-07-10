"use client";

import { createAuthClient } from "better-auth/react";
import {
  usernameClient,
  twoFactorClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";

import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [
    usernameClient(),
    twoFactorClient(),
    inferAdditionalFields<typeof auth>(),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
