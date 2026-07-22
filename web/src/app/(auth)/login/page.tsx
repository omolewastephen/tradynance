import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentSession } from "@/lib/auth-session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in — Tradynance" };

export default async function LoginPage() {
  // Real, DB-backed session check. The middleware deliberately does NOT redirect /login→/dashboard
  // on cookie presence — a stale/invalid cookie made that loop forever with requireUser (which
  // redirects the other way). So a genuinely valid session is sent on here; an invalid-but-present
  // cookie just falls through to the form, which overwrites it on the next successful login.
  const session = await getCurrentSession();
  if (session) redirect("/dashboard");

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
        Welcome back
      </h1>
      <p className="mt-2 text-sm text-foreground-muted">
        New to Tradynance?{" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-8">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
