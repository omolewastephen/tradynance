import Link from "next/link";
import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset password — Tradynance" };

export default function ForgotPasswordPage() {
  return (
    <Card className="w-full">
        <CardHeader>
          <CardTitle className="font-display text-h3">Reset your password</CardTitle>
          <CardDescription>
            <Link href="/login" className="text-accent hover:underline">
              Back to sign in
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
  );
}
