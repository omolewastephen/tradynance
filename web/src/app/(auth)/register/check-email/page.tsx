import Link from "next/link";
import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Check your email — Tradynance" };

export default function CheckEmailPage() {
  return (
    <Card className="w-full">
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
  );
}
