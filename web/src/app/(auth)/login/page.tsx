import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in — Tradynance" };

export default function LoginPage() {
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
