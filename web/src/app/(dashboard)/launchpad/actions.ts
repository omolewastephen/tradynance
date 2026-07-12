"use server";

import { revalidatePath } from "next/cache";

import { commitToLaunchpad, claimLaunchpad, type CommitResult, type ClaimResult, type PrismaClient } from "@tradynance/core";
import { requireUser } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export async function commitProject(projectId: string, amount: string): Promise<CommitResult> {
  const session = await requireUser();
  const result = await commitToLaunchpad(prisma as PrismaClient, { userId: session.user.id, projectId, amount });
  if (result.ok) {
    revalidatePath("/launchpad");
    revalidatePath("/wallet");
  }
  return result;
}

export async function claimProject(projectId: string): Promise<ClaimResult> {
  const session = await requireUser();
  const result = await claimLaunchpad(prisma as PrismaClient, { userId: session.user.id, projectId });
  if (result.ok) {
    revalidatePath("/launchpad");
    revalidatePath("/wallet");
  }
  return result;
}
