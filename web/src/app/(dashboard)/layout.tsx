import Link from "next/link";

import { requireUser } from "@/lib/auth-session";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
        <Link href="/dashboard" className="font-display text-lg font-semibold">
          Tradynance
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-foreground-muted hover:text-foreground">
            Overview
          </Link>
          <Link href="/wallet" className="text-foreground-muted hover:text-foreground">
            Wallet
          </Link>
          <Link
            href="/settings/security"
            className="text-foreground-muted hover:text-foreground"
          >
            Security
          </Link>
          {["SUPER_ADMIN", "ADMIN"].includes(session.user.role as string) && (
            <Link href="/admin" className="text-foreground-muted hover:text-foreground">
              Admin
            </Link>
          )}
          <span className="text-foreground-muted">{session.user.email}</span>
          <SignOutButton />
        </nav>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
