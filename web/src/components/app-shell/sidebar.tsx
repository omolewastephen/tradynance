"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { sectionsFor, isActive } from "./nav-items";

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const sections = sectionsFor(isAdmin);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border-subtle bg-surface/40 md:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" aria-label="Tradynance home">
          <Logo />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-6 px-3 py-2">
        {sections.map((section, i) => (
          <div key={i} className="flex flex-col gap-1">
            {section.heading && (
              <span className="px-3 pb-1 text-micro uppercase tracking-wide text-foreground-muted">
                {section.heading}
              </span>
            )}
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-foreground-muted hover:bg-surface hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
