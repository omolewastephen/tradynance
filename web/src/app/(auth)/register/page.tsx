import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentSession } from "@/lib/auth-session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account — Tradynance" };

export default async function RegisterPage() {
  // Real session check (middleware no longer bounces auth pages on cookie presence — see login).
  const session = await getCurrentSession();
  if (session) redirect("/dashboard");

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>

      <div className="mt-8">
        <Suspense fallback={null}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
