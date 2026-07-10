import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { username, twoFactor } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/prisma";

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
      // TODO(Phase 1 follow-up): wire a real transactional email provider (Resend/SendGrid).
      // Logged to console so the reset flow is testable end to end in dev.
      console.log(`[auth] password reset for ${user.email}: ${url}`);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // TODO(Phase 1 follow-up): wire a real transactional email provider.
      console.log(`[auth] verification email for ${user.email}: ${url}`);
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
});

export type Session = typeof auth.$Infer.Session;
