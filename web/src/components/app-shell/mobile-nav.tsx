"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { sectionsFor, isActive } from "./nav-items";

// Horizontal scrollable nav shown under the topbar on small screens (sidebar is hidden there).
export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = sectionsFor(isAdmin).flatMap((s) => s.items);

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border-subtle bg-surface/40 px-3 py-2 md:hidden">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-primary-muted font-medium text-primary"
                : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
