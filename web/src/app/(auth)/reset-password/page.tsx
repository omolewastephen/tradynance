import { Suspense } from "react";
import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Set new password — Tradynance" };

export default function ResetPasswordPage() {
  return (
    <Card className="w-full">
        <CardHeader>
          <CardTitle className="font-display text-h3">Set a new password</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
  );
}
