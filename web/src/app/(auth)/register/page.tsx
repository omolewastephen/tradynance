import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentSession } from "@/lib/auth-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account — Tradynance" };

export default async function RegisterPage() {
  // Real session check (middleware no longer bounces auth pages on cookie presence — see login).
  const session = await getCurrentSession();
  if (session) redirect("/dashboard");

  return (
    <Card className="w-full">
        <CardHeader>
          <CardTitle className="font-display text-h3">Create your account</CardTitle>
          <CardDescription>
            Already have an account?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <RegisterForm />
          </Suspense>
        </CardContent>
      </Card>
  );
}
