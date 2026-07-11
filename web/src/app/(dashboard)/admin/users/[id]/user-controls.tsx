"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { setUserStatus, setUserRole, resetUser2FA, setKycStatus } from "../actions";

const STATUSES = ["ACTIVE", "SUSPENDED", "FROZEN", "BANNED"] as const;
const ROLES = [
  "USER", "SUPPORT", "MODERATOR", "FINANCE", "COMPLIANCE", "DEVELOPER", "AUDITOR", "ADMIN", "SUPER_ADMIN",
] as const;
const KYC = ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"] as const;

export function UserControls({
  userId,
  status,
  role,
  kyc,
  twoFactorEnabled,
  canManageRoles,
  isSelf,
  targetIsSuperAdmin,
}: {
  userId: string;
  status: string;
  role: string;
  kyc: string;
  twoFactorEnabled: boolean;
  canManageRoles: boolean;
  isSelf: boolean;
  targetIsSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Failed" });
      if (res.ok) router.refresh();
    });
  }

  const lockStatus = isSelf || targetIsSuperAdmin;

  return (
    <div className="flex flex-col gap-5">
      {/* status */}
      <div>
        <div className="mb-2 text-micro uppercase tracking-wide text-foreground-muted">Status</div>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              disabled={isPending || lockStatus || s === status}
              onClick={() => run(() => setUserStatus(userId, s), `Status set to ${s}`)}
              className={cn(
                "rounded-sm border px-3 py-1.5 text-sm transition-colors disabled:opacity-40",
                s === status
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground-muted hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        {lockStatus && (
          <p className="mt-1 text-xs text-foreground-muted">
            {isSelf ? "You can't change your own status." : "Can't act on a super admin."}
          </p>
        )}
      </div>

      {/* KYC */}
      <div>
        <div className="mb-2 text-micro uppercase tracking-wide text-foreground-muted">KYC</div>
        <div className="flex flex-wrap gap-2">
          {KYC.map((k) => (
            <button
              key={k}
              disabled={isPending || k === kyc}
              onClick={() => run(() => setKycStatus(userId, k), `KYC set to ${k}`)}
              className={cn(
                "rounded-sm border px-3 py-1.5 text-sm transition-colors disabled:opacity-40",
                k === kyc
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground-muted hover:text-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* role (super admin only) */}
      {canManageRoles && (
        <div>
          <div className="mb-2 text-micro uppercase tracking-wide text-foreground-muted">Role</div>
          <select
            defaultValue={role}
            disabled={isPending || isSelf}
            onChange={(e) => run(() => setUserRole(userId, e.target.value as never), `Role set to ${e.target.value}`)}
            className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:opacity-40"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {isSelf && (
            <p className="mt-1 text-xs text-foreground-muted">You can&apos;t change your own role.</p>
          )}
        </div>
      )}

      {/* reset 2FA */}
      <div>
        <div className="mb-2 text-micro uppercase tracking-wide text-foreground-muted">
          Two-factor
        </div>
        <button
          disabled={isPending || !twoFactorEnabled}
          onClick={() => run(() => resetUser2FA(userId), "2FA reset — user can re-enroll")}
          className="rounded-sm border border-border px-3 py-1.5 text-sm text-foreground-muted transition-colors hover:text-danger disabled:opacity-40"
        >
          {twoFactorEnabled ? "Reset 2FA" : "2FA not enabled"}
        </button>
      </div>

      {msg && <p className={cn("text-sm", msg.ok ? "text-primary" : "text-danger")}>{msg.text}</p>}
    </div>
  );
}
