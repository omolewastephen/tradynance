"use client";

import { useState } from "react";
import QRCode from "qrcode";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "view" | "enable-password" | "scan" | "just-enabled" | "disable-password";

export function TwoFactorSection({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [mode, setMode] = useState<Mode>("view");
  const [password, setPassword] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startEnable() {
    setError(null);
    setBusy(true);
    const { data, error: err } = await authClient.twoFactor.enable({ password });
    setBusy(false);
    if (err || !data) {
      setError(err?.message ?? "Could not start 2FA setup. Check your password.");
      return;
    }
    setBackupCodes(data.backupCodes);
    setQrDataUrl(await QRCode.toDataURL(data.totpURI));
    setMode("scan");
  }

  async function confirmEnable() {
    setError(null);
    setBusy(true);
    const { error: err } = await authClient.twoFactor.verifyTotp({ code });
    setBusy(false);
    if (err) {
      setError(err.message ?? "Invalid code.");
      return;
    }
    setEnabled(true);
    setMode("just-enabled");
  }

  async function disable() {
    setError(null);
    setBusy(true);
    const { error: err } = await authClient.twoFactor.disable({ password });
    setBusy(false);
    if (err) {
      setError(err.message ?? "Could not disable 2FA. Check your password.");
      return;
    }
    setEnabled(false);
    setMode("view");
    setPassword("");
  }

  if (enabled) {
    if (mode === "disable-password") {
      return (
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="disablePassword">Confirm password</Label>
            <Input
              id="disablePassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button size="sm" variant="destructive" disabled={busy} onClick={disable}>
            Confirm disable
          </Button>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-primary">Two-factor authentication is enabled.</p>
        {mode === "just-enabled" && backupCodes.length > 0 && (
          <div className="rounded-sm border border-border bg-surface p-3">
            <p className="mb-2 text-xs text-foreground-muted">
              Backup codes — store these somewhere safe. Each can be used once if you lose
              access to your authenticator app.
            </p>
            <div className="grid grid-cols-2 gap-1 font-mono text-xs tabular-nums">
              {backupCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          </div>
        )}
        <Button
          variant="destructive"
          size="sm"
          className="w-fit"
          onClick={() => setMode("disable-password")}
        >
          Disable 2FA
        </Button>
      </div>
    );
  }

  if (mode === "view") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-foreground-muted">
          Add an authenticator app (Google Authenticator, Authy, 1Password) as a second
          factor on sign-in.
        </p>
        <Button size="sm" className="w-fit" onClick={() => setMode("enable-password")}>
          Enable 2FA
        </Button>
      </div>
    );
  }

  if (mode === "enable-password") {
    return (
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="enablePassword">Confirm password</Label>
          <Input
            id="enablePassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button size="sm" disabled={busy || !password} onClick={startEnable}>
          Continue
        </Button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  // mode === "scan"
  return (
    <div className="flex flex-col gap-3">
      {qrDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- data URL, not an optimizable asset
        <img src={qrDataUrl} alt="Scan with your authenticator app" className="size-40" />
      )}
      <p className="text-xs text-foreground-muted">
        Scan the QR code, then enter the 6-digit code it generates.
      </p>
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="totpConfirm">Code</Label>
          <Input
            id="totpConfirm"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono tracking-[0.3em]"
          />
        </div>
        <Button size="sm" disabled={busy || code.length !== 6} onClick={confirmEnable}>
          Confirm
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
