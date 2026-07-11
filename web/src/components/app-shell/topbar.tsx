import Link from "next/link";
import { UserRound } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { NotificationBell } from "@/components/app-shell/notification-bell";

// Sticky glass topbar. Glassmorphism is scoped to the nav per docs/DESIGN_SYSTEM.md.
export function Topbar({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border-subtle bg-background/70 px-4 backdrop-blur-md md:px-6">
      {/* Logo shows here only on mobile, where the sidebar is hidden. */}
      <Link href="/dashboard" className="md:hidden" aria-label="Tradynance home">
        <Logo />
      </Link>
      <div className="hidden md:block" />

      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1.5 text-sm text-foreground-muted sm:flex">
          <UserRound className="size-4" />
          {email}
        </span>
        <NotificationBell />
        <SignOutButton />
      </div>
    </header>
  );
}
