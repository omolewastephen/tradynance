"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { FINANCE_ROLES } from "@/lib/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

const projectSchema = z
  .object({
    name: z.string().trim().min(2, "Give the project a name").max(80),
    tokenSymbol: z.string().trim().toUpperCase().min(1, "Pick the token being sold"),
    saleSymbol: z.string().trim().toUpperCase().min(1, "Pick the asset users pay with"),
    tokenPrice: z.string().trim().refine((v) => Number(v) > 0, "Token price must be positive"),
    totalAllocation: z
      .string()
      .trim()
      .refine((v) => Number(v) > 0, "Total allocation must be positive"),
    minCommit: z.string().trim().refine((v) => Number(v) > 0, "Min commit must be positive"),
    maxCommit: z.string().trim().refine((v) => Number(v) > 0, "Max commit must be positive"),
    startAt: z.string().trim().min(1, "Pick a start date"),
    endAt: z.string().trim().min(1, "Pick an end date"),
    status: z.enum(["UPCOMING", "LIVE", "ENDED", "DISTRIBUTED"]),
    description: z.string().trim().min(10, "Add a short description").max(2000),
  })
  .refine((d) => Number(d.maxCommit) >= Number(d.minCommit), {
    message: "Max commit must be at least the min commit",
    path: ["maxCommit"],
  })
  .refine((d) => new Date(d.endAt) > new Date(d.startAt), {
    message: "End date must be after the start date",
    path: ["endAt"],
  });

function parse(formData: FormData) {
  return projectSchema.safeParse({
    name: formData.get("name"),
    tokenSymbol: formData.get("tokenSymbol"),
    saleSymbol: formData.get("saleSymbol"),
    tokenPrice: formData.get("tokenPrice"),
    totalAllocation: formData.get("totalAllocation"),
    minCommit: formData.get("minCommit"),
    maxCommit: formData.get("maxCommit"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    status: formData.get("status"),
    description: formData.get("description"),
  });
}

async function resolveAssets(tokenSymbol: string, saleSymbol: string) {
  const [token, sale] = await Promise.all([
    prisma.asset.findUnique({ where: { symbol: tokenSymbol } }),
    prisma.asset.findUnique({ where: { symbol: saleSymbol } }),
  ]);
  return { token, sale };
}

export async function createLaunchpadProject(formData: FormData): Promise<ActionResult> {
  const session = await requireRole([...FINANCE_ROLES]);
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  const { token, sale } = await resolveAssets(d.tokenSymbol, d.saleSymbol);
  if (!token) return { ok: false, error: `Unknown token asset ${d.tokenSymbol}` };
  if (!sale) return { ok: false, error: `Unknown sale asset ${d.saleSymbol}` };

  const project = await prisma.launchpadProject.create({
    data: {
      name: d.name,
      tokenSymbol: d.tokenSymbol,
      tokenAssetId: token.id,
      saleAssetId: sale.id,
      tokenPrice: d.tokenPrice,
      totalAllocation: d.totalAllocation,
      minCommit: d.minCommit,
      maxCommit: d.maxCommit,
      startAt: new Date(d.startAt),
      endAt: new Date(d.endAt),
      status: d.status,
      description: d.description,
    },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "launchpad.project_create",
    entityType: "LaunchpadProject",
    entityId: project.id,
    metadata: { name: d.name, token: d.tokenSymbol, allocation: d.totalAllocation },
  });

  revalidatePath("/admin/launchpad");
  revalidatePath("/launchpad");
  return { ok: true };
}

export async function updateLaunchpadProject(formData: FormData): Promise<ActionResult> {
  const session = await requireRole([...FINANCE_ROLES]);
  const id = String(formData.get("id") ?? "");
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  const existing = await prisma.launchpadProject.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Project not found" };

  // Never shrink the allocation below what users have already committed to.
  if (Number(d.totalAllocation) < Number(existing.soldAllocation)) {
    return {
      ok: false,
      error: `Allocation can't be below the ${existing.soldAllocation.toString()} already committed.`,
    };
  }

  const { token, sale } = await resolveAssets(d.tokenSymbol, d.saleSymbol);
  if (!token) return { ok: false, error: `Unknown token asset ${d.tokenSymbol}` };
  if (!sale) return { ok: false, error: `Unknown sale asset ${d.saleSymbol}` };

  await prisma.launchpadProject.update({
    where: { id },
    data: {
      name: d.name,
      tokenSymbol: d.tokenSymbol,
      tokenAssetId: token.id,
      saleAssetId: sale.id,
      tokenPrice: d.tokenPrice,
      totalAllocation: d.totalAllocation,
      minCommit: d.minCommit,
      maxCommit: d.maxCommit,
      startAt: new Date(d.startAt),
      endAt: new Date(d.endAt),
      status: d.status,
      description: d.description,
    },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "launchpad.project_update",
    entityType: "LaunchpadProject",
    entityId: id,
    metadata: { name: d.name, status: d.status },
  });

  revalidatePath("/admin/launchpad");
  revalidatePath("/launchpad");
  return { ok: true };
}

/** Projects with commitments are never deleted — users have real funds committed against them. */
export async function deleteLaunchpadProject(formData: FormData): Promise<ActionResult> {
  const session = await requireRole([...FINANCE_ROLES]);
  const id = String(formData.get("id") ?? "");

  const commitments = await prisma.launchpadCommitment.count({ where: { projectId: id } });
  if (commitments > 0) {
    return {
      ok: false,
      error: `Project has ${commitments} commitment(s) and can't be deleted. Set it to ENDED instead.`,
    };
  }

  await prisma.launchpadProject.delete({ where: { id } });
  await recordAudit({
    actorId: session.user.id,
    action: "launchpad.project_delete",
    entityType: "LaunchpadProject",
    entityId: id,
  });

  revalidatePath("/admin/launchpad");
  revalidatePath("/launchpad");
  return { ok: true };
}
