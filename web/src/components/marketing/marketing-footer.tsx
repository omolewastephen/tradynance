import Link from "next/link";

import { Logo } from "@/components/brand/logo";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Markets", href: "/markets" },
      { label: "Spot trading", href: "/trade" },
      { label: "Futures", href: "/futures" },
      { label: "Staking", href: "/staking" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Log in", href: "/login" },
      { label: "Create account", href: "/register" },
      { label: "Security", href: "/settings/security" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Logo size="md" />
            <p className="mt-3 max-w-xs text-sm text-foreground-muted">
              The professional crypto exchange — spot, futures, staking and more, on an
              append-only ledger.
            </p>
          </div>
          {COLUMNS.map((c) => (
            <div key={c.heading}>
              <div className="mb-3 text-micro font-medium uppercase tracking-wide text-foreground-subtle">
                {c.heading}
              </div>
              <ul className="flex flex-col gap-2">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-foreground-muted transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border-subtle pt-6 text-xs text-foreground-subtle sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Tradynance. All rights reserved.</span>
          <span>
            Trading digital assets carries risk. Nothing here is financial advice. Compliance and
            licensing are the operator&apos;s responsibility.
          </span>
        </div>
      </div>
    </footer>
  );
}
