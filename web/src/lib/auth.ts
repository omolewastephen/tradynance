import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { username, twoFactor } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/prisma";
import {
  sendPasswordResetEmail,
  sendVerificationEmail as sendVerifyEmail,
} from "@/lib/email";

function generateReferralCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    autoSignIn: false,
    sendResetPassword: async ({ user, url }) => {
      // Real send via Resend when RESEND_API_KEY is set; console fallback in dev (see email.ts).
      await sendPasswordResetEmail(
        user.email,
        url,
        (user as { antiPhishingCode?: string }).antiPhishingCode,
      );
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerifyEmail(user.email, url);
    },
  },

  user: {
    additionalFields: {
      country: { type: "string", required: false, input: true },
      phone: { type: "string", required: false, input: true },
      role: { type: "string", required: false, input: false },
      status: { type: "string", required: false, input: false },
      kycStatus: { type: "string", required: false, input: false },
      antiPhishingCode: { type: "string", required: false, input: false },
      // This user's own shareable code — generated server-side in the create hook below.
      // Must be declared here or better-auth strips it from the hook's return value before
      // it reaches the adapter, even though it's a real Prisma column.
      referralCode: { type: "string", required: false, input: false },
      // Resolved from `referralCodeUsed` (below) to the referrer's id in the create hook.
      referredById: { type: "string", required: false, input: false, returned: false },
      // The referral code entered at signup, if any. Kept as a historical record; also
      // resolved to `referredById` in the create hook below. Hidden from API responses.
      referralCodeUsed: {
        type: "string",
        required: false,
        input: true,
        returned: false,
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const referralCodeUsed = (user as { referralCodeUsed?: string }).referralCodeUsed;

          let referredById: string | undefined;
          if (referralCodeUsed) {
            const referrer = await prisma.user.findUnique({
              where: { referralCode: referralCodeUsed.trim().toUpperCase() },
              select: { id: true },
            });
            referredById = referrer?.id;
          }

          return {
            data: {
              ...user,
              referralCode: generateReferralCode(),
              referredById,
            },
          };
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await prisma.loginHistory.create({
            data: {
              userId: session.userId,
              ipAddress: session.ipAddress ?? undefined,
              userAgent: session.userAgent ?? undefined,
            },
          });
        },
      },
    },
  },

  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 24,
    }),
    twoFactor({
      issuer: "Tradynance",
    }),
    nextCookies(), // must stay last — sets cookies from server actions
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once per day of activity
  },

  // Brute-force protection on the auth surface. `enabled: true` forces it on in dev too (it's
  // production-only by default). Memory storage suits the single-node deployment; switch to
  // "database" or a secondary (Redis) store for multi-instance — see Phase 11 notes.
  rateLimit: {
    enabled: true,
    window: 60, // default: 100 requests / 60s / IP across auth endpoints
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 }, // password guessing
      "/sign-up/email": { window: 300, max: 5 }, // signup abuse
      "/request-password-reset": { window: 300, max: 3 }, // reset spam
      "/reset-password": { window: 300, max: 5 },
      "/two-factor/verify-totp": { window: 60, max: 5 }, // TOTP guessing
      "/two-factor/verify-backup-code": { window: 300, max: 5 },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
