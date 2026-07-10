"use server";

import { z } from "zod";

import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

const antiPhishingSchema = z
  .string()
  .trim()
  .min(4, "At least 4 characters")
  .max(20, "At most 20 characters")
  .regex(/^[a-zA-Z0-9]+$/, "Letters and numbers only");

export async function updateAntiPhishingCode(rawCode: string) {
  const session = await requireUser();
  const code = antiPhishingSchema.parse(rawCode);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { antiPhishingCode: code },
  });

  return { code };
}
