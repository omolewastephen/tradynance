import { z } from "zod";

export const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    username: z
      .string()
      .trim()
      .min(3, "At least 3 characters")
      .max(24, "At most 24 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .max(128)
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[0-9]/, "Include a number"),
    confirmPassword: z.string(),
    country: z.string().min(1, "Select your country"),
    phone: z.string().trim().optional().or(z.literal("")),
    referralCode: z.string().trim().optional().or(z.literal("")),
    agreeToTerms: z
      .boolean()
      .refine((v) => v === true, "You must agree to the KYC/AML policy and Terms of Service"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const totpSchema = z.object({
  code: z.string().length(6, "Enter the 6-digit code").regex(/^\d+$/, "Digits only"),
  trustDevice: z.boolean(),
});

export type TotpInput = z.infer<typeof totpSchema>;
