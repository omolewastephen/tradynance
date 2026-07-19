"use client";

import { LogOut } from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await authClient.signOut();
        // Hard navigation so all server components re-render with the session cleared — a soft
        // router.push + router.refresh races and can leave the user on a now-stale authed page.
        window.location.assign("/login");
      }}
    >
      <LogOut className="size-4" />
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}
