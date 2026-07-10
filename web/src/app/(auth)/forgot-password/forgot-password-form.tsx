"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});
type Input = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Input>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  async function onSubmit(values: Input) {
    await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: "/reset-password",
    });
    // Always show the same confirmation regardless of whether the email exists —
    // avoids leaking which addresses are registered.
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-sm text-foreground-muted">
        If an account exists for that email, a password reset link is on its way. In local
        development it&apos;s logged to the server console instead of emailed.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
