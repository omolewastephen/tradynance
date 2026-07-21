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
            The link expires shortly for your security. If it doesn&apos;t arrive within a few
            minutes, check your spam folder — or{" "}
            <Link href="/contact" className="text-accent hover:underline">
              contact support
            </Link>{" "}
            and we&apos;ll help you get set up.
          </p>
        </CardContent>
      </Card>
  );
}
