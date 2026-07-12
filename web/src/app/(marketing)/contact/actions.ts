"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { enforceRateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email").max(120),
  subject: z.string().trim().min(1, "Add a subject").max(140),
  message: z.string().trim().min(10, "Tell us a bit more (10+ characters)").max(4000),
});

export type ContactResult = { ok: true } | { ok: false; error: string };

export async function submitContact(formData: FormData): Promise<ContactResult> {
  // Public endpoint → rate-limit by IP to stop spam.
  const ip = await clientIp();
  const limited = enforceRateLimit("contact:submit", ip, 5, 10 * 60_000);
  if (!limited.ok) return { ok: false, error: limited.error };

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  await prisma.contactMessage.create({ data: parsed.data });
  return { ok: true };
}
