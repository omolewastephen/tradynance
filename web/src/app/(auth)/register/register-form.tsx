"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { COUNTRIES } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectNative } from "@/components/ui/select-native";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  // Same hydration gate as the login form: before React attaches onSubmit, a click would fall back
  // to a native GET submission and put the password in the URL (history + server logs).
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched", // validate on blur — guidance while filling, not a wall of errors at the end
    defaultValues: {
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      country: "",
      phone: "",
      referralCode: searchParams.get("ref") ?? "",
      agreeToTerms: false,
    },
  });

  async function onSubmit(values: RegisterInput) {
    setServerError(null);
    const { error } = await authClient.signUp.email({
      email: values.email,
      password: values.password,
      name: values.username,
      username: values.username,
      country: values.country,
      phone: values.phone || undefined,
      // Resolved to `referredById` server-side by the user.create databaseHook in auth.ts.
      referralCodeUsed: values.referralCode || undefined,
      callbackURL: "/login?verified=1",
    });

    if (error) {
      setServerError(error.message ?? "Registration failed. Try again.");
      return;
    }

    router.push("/register/check-email");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {serverError && (
        <p
          role="alert"
          className="rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {serverError}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          className="h-11"
          {...register("email")}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="text-xs text-danger">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          autoComplete="username"
          aria-invalid={!!errors.username}
          aria-describedby={errors.username ? "username-error" : undefined}
          className="h-11"
          {...register("username")}
        />
        {errors.username && (
          <p id="username-error" role="alert" className="text-xs text-danger">
            {errors.username.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : "password-hint"}
            className="h-11"
            {...register("password")}
          />
          {errors.password && (
            <p id="password-error" role="alert" className="text-xs text-danger">
              {errors.password.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
            className="h-11"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p id="confirmPassword-error" role="alert" className="text-xs text-danger">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
      </div>
      {/* Persistent guidance (matches the zod rules) — shown up front, not only as an error. */}
      <p id="password-hint" className="-mt-2 text-xs text-foreground-muted">
        8+ characters with an uppercase letter, a lowercase letter and a number.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="country">Country</Label>
          <SelectNative
            id="country"
            aria-invalid={!!errors.country}
            aria-describedby={errors.country ? "country-error" : undefined}
            className="h-11"
            {...register("country")}
          >
            <option value="">Select country</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectNative>
          {errors.country && (
            <p id="country-error" role="alert" className="text-xs text-danger">
              {errors.country.message}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" type="tel" autoComplete="tel" className="h-11" {...register("phone")} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="referralCode">Referral code (optional)</Label>
        <Input id="referralCode" autoComplete="off" className="h-11" {...register("referralCode")} />
      </div>

      <div className="flex items-start gap-2 pt-1">
        <Controller
          name="agreeToTerms"
          control={control}
          render={({ field }) => (
            <Checkbox
              id="agreeToTerms"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              className="mt-0.5"
            />
          )}
        />
        <Label htmlFor="agreeToTerms" className="text-sm font-normal text-foreground-muted">
          I agree to the Terms of Service and confirm I will complete KYC/AML verification
          as required.
        </Label>
      </div>
      {errors.agreeToTerms && (
        <p role="alert" className="-mt-2 text-xs text-danger">
          {errors.agreeToTerms.message}
        </p>
      )}

      <Button type="submit" disabled={!hydrated || isSubmitting} className="mt-2 h-11 shadow-glow">
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
