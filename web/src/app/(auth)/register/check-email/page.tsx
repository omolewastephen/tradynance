import Link from "next/link";
import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Check your email — Tradynance" };

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display text-h3">Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to the address you registered with. Click it to
            activate your account, then{" "}
            <Link href="/login" className="text-accent hover:underline">
              sign in
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground-muted">
            In local development, the verification link is logged to the server console
            instead of being emailed — see the `sendVerificationEmail` TODO in
            `src/lib/auth.ts`.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
