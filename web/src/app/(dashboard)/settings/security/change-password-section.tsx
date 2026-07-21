"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    if (newPassword.length < 8) {
      setResult({ ok: false, text: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setResult({ ok: false, text: "New passwords don't match." });
      return;
    }

    setBusy(true);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      // Signing every other device out is the safe default when a password changes — if the old
      // one was compromised, an attacker's session dies with it.
      revokeOtherSessions: revokeOthers,
    });
    setBusy(false);

    if (error) {
      setResult({ ok: false, text: error.message ?? "Could not change password. Check your current password." });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setResult({
      ok: true,
      text: revokeOthers
        ? "Password updated. Other devices have been signed out."
        : "Password updated.",
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <span className="text-xs text-foreground-muted">At least 8 characters.</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="revoke-others"
          type="checkbox"
          checked={revokeOthers}
          onChange={(e) => setRevokeOthers(e.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        <Label htmlFor="revoke-others" className="font-normal text-foreground-muted">
          Sign out all other devices
        </Label>
      </div>

      {result && (
        <p className={`text-sm ${result.ok ? "text-primary" : "text-danger"}`}>{result.text}</p>
      )}

      <Button type="submit" disabled={busy} className="w-fit">
        <KeyRound className="size-4" />
        {busy ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
