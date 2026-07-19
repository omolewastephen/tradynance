import Link from "next/link";

import { getCurrentSession } from "@/lib/auth-session";
import { Logo } from "@/components/brand/logo";

const NAV = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export async function MarketingHeader() {
  const session = await getCurrentSession();

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="Tradynance home">
          <Logo size="md" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-sm text-foreground-muted transition-colors hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {session ? (
            <Link
              href="/dashboard"
              className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-sm px-3 py-2 text-sm text-foreground-muted transition-colors hover:text-foreground sm:block"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
