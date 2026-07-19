import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentSession } from "@/lib/auth-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="w-full">
        <CardHeader>
          <CardTitle className="font-display text-h3">Sign in</CardTitle>
          <CardDescription>
            New to Tradynance?{" "}
            <Link href="/register" className="text-accent hover:underline">
              Create an account
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
  );
}
