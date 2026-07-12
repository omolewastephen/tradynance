"use server";

import { revalidatePath } from "next/cache";

import { Prisma, type Role, type UserStatus, type KycStatus } from "@tradynance/core";
import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { USER_ADMIN_ROLES, COMPLIANCE_ROLES } from "@/lib/admin";

type Result = { ok: true } | { ok: false; error: string };

// Thin wrapper over the shared, IP-capturing audit helper (all admin actions here act on a User).
async function audit(
  actorId: string,
  action: string,
  userId: string,
  metadata: Prisma.InputJsonValue,
) {
  await recordAudit({ actorId, action, entityType: "User", entityId: userId, metadata });
}

const VALID_STATUS: UserStatus[] = ["ACTIVE", "SUSPENDED", "FROZEN", "BANNED"];

export async function setUserStatus(userId: string, status: UserStatus): Promise<Result> {
  const session = await requireRole(USER_ADMIN_ROLES);
  if (!VALID_STATUS.includes(status)) return { ok: false, error: "Invalid status" };
  if (userId === session.user.id) return { ok: false, error: "You can't change your own status" };

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return { ok: false, error: "User not found" };
  if (target.role === "SUPER_ADMIN") return { ok: false, error: "Can't act on a super admin" };

  await prisma.user.update({ where: { id: userId }, data: { status } });
  await audit(session.user.id, "user.set_status", userId, { status });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return { ok: true };
}

const VALID_ROLES: Role[] = [
  "SUPER_ADMIN", "ADMIN", "FINANCE", "SUPPORT",
  "COMPLIANCE", "MODERATOR", "DEVELOPER", "AUDITOR", "USER",
];

export async function setUserRole(userId: string, role: Role): Promise<Result> {
  // Only a super admin can change roles (privilege escalation guard).
  const session = await requireRole(["SUPER_ADMIN"]);
  if (!VALID_ROLES.includes(role)) return { ok: false, error: "Invalid role" };
  if (userId === session.user.id) return { ok: false, error: "You can't change your own role" };

  await prisma.user.update({ where: { id: userId }, data: { role } });
  await audit(session.user.id, "user.set_role", userId, { role });
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

export async function resetUser2FA(userId: string): Promise<Result> {
  const session = await requireRole(USER_ADMIN_ROLES);
  // Remove the 2FA secret + backup codes and clear the flag, so the user can re-enroll.
  await prisma.$transaction([
    prisma.twoFactor.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } }),
  ]);
  await audit(session.user.id, "user.reset_2fa", userId, {});
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true };
}

const VALID_KYC: KycStatus[] = ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"];

export async function setKycStatus(userId: string, kycStatus: KycStatus): Promise<Result> {
  const session = await requireRole(COMPLIANCE_ROLES);
  if (!VALID_KYC.includes(kycStatus)) return { ok: false, error: "Invalid KYC status" };

  await prisma.user.update({ where: { id: userId }, data: { kycStatus } });
  await audit(session.user.id, "user.set_kyc", userId, { kycStatus });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/kyc");
  return { ok: true };
}
