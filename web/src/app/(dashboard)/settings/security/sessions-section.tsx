"use client";

import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

type SessionRow = {
  id: string;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string | Date;
  isCurrent: boolean;
};

export function SessionsSection({ currentToken }: { currentToken: string }) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [busyToken, setBusyToken] = useState<string | null>(null);

  useEffect(() => {
    authClient.listSessions().then(({ data }) => {
      if (!data) return;
      setSessions(
        data
          .map((s) => ({ ...s, isCurrent: s.token === currentToken }))
          .sort((a) => (a.isCurrent ? -1 : 1)),
      );
    });
  }, [currentToken]);

  async function revoke(token: string) {
    setBusyToken(token);
    await authClient.revokeSession({ token });
    setSessions((prev) => prev?.filter((s) => s.token !== token) ?? null);
    setBusyToken(null);
  }

  if (!sessions) {
    return <p className="text-sm text-foreground-muted">Loading sessions…</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {sessions.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between rounded-sm border border-border-subtle bg-surface px-3 py-2 text-sm"
        >
          <div className="flex flex-col">
            <span className="font-mono text-xs">
              {s.ipAddress ?? "unknown IP"}
              {s.isCurrent && <span className="ml-2 text-primary">this device</span>}
            </span>
            <span className="truncate text-xs text-foreground-muted">
              {s.userAgent ?? "unknown device"}
            </span>
            <span className="text-xs text-foreground-muted">
              {new Date(s.createdAt).toLocaleString()}
            </span>
          </div>
          {!s.isCurrent && (
            <Button
              size="sm"
              variant="outline"
              disabled={busyToken === s.token}
              onClick={() => revoke(s.token)}
            >
              Revoke
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
