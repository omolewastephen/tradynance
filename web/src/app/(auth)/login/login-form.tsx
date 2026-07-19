"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { authClient } from "@/lib/auth-client";
import { loginSchema, totpSchema, type LoginInput, type TotpInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Controller } from "react-hook-form";

export function LoginForm() {
  const searchParams = useSearchParams();
  // Only allow same-origin relative paths as the post-login destination — never an absolute or
  // protocol-relative URL (open-redirect guard, since `next` comes straight from the query string).
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const dest = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
  const [serverError, setServerError] = useState<string | null>(null);
  const [awaitingTotp, setAwaitingTotp] = useState(false);

  const credentialsForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: true },
  });

  const totpForm = useForm<TotpInput>({
    resolver: zodResolver(totpSchema),
    defaultValues: { code: "", trustDevice: false },
  });

  async function onCredentialsSubmit(values: LoginInput) {
    setServerError(null);
    const { data, error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
      rememberMe: values.rememberMe,
    });

    if (error) {
      setServerError(error.message ?? "Invalid email or password.");
      return;
    }

    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setAwaitingTotp(true);
      return;
    }

    // Hard navigation across the auth boundary: guarantees every server component (layouts, the
    // dashboard's requireUser check) re-renders with the just-set session cookie. A soft
    // router.push + router.refresh here races — the refresh can cancel the navigation or serve a
    // stale logged-out router-cache entry for the destination, leaving the user stuck on /login.
    window.location.assign(dest);
  }

  async function onTotpSubmit(values: TotpInput) {
    setServerError(null);
    const { error } = await authClient.twoFactor.verifyTotp({
      code: values.code,
      trustDevice: values.trustDevice,
    });

    if (error) {
      setServerError(error.message ?? "Invalid code. Try again.");
      return;
    }

    window.location.assign(dest);
  }

  if (awaitingTotp) {
    return (
      <form
        onSubmit={totpForm.handleSubmit(onTotpSubmit)}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-foreground-muted">
          Enter the 6-digit code from your authenticator app.
        </p>
        {serverError && (
          <p className="rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {serverError}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="code">Authentication code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="font-mono tracking-[0.3em]"
            {...totpForm.register("code")}
          />
          {totpForm.formState.errors.code && (
            <p className="text-xs text-danger">
              {totpForm.formState.errors.code.message}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Controller
            name="trustDevice"
            control={totpForm.control}
            render={({ field }) => (
              <Checkbox
                id="trustDevice"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
          <Label htmlFor="trustDevice" className="text-sm font-normal text-foreground-muted">
            Trust this device for 30 days
          </Label>
        </div>
        <Button type="submit" disabled={totpForm.formState.isSubmitting}>
          {totpForm.formState.isSubmitting ? "Verifying…" : "Verify"}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={credentialsForm.handleSubmit(onCredentialsSubmit)}
      className="flex flex-col gap-4"
    >
      {serverError && (
        <p className="rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {serverError}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...credentialsForm.register("email")}
        />
        {credentialsForm.formState.errors.email && (
          <p className="text-xs text-danger">
            {credentialsForm.formState.errors.email.message}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <a href="/forgot-password" className="text-xs text-accent hover:underline">
            Forgot password?
          </a>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...credentialsForm.register("password")}
        />
        {credentialsForm.formState.errors.password && (
          <p className="text-xs text-danger">
            {credentialsForm.formState.errors.password.message}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Controller
          name="rememberMe"
          control={credentialsForm.control}
          render={({ field }) => (
            <Checkbox
              id="rememberMe"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        />
        <Label htmlFor="rememberMe" className="text-sm font-normal text-foreground-muted">
          Remember me
        </Label>
      </div>
      <Button type="submit" disabled={credentialsForm.formState.isSubmitting} className="mt-1">
        {credentialsForm.formState.isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
