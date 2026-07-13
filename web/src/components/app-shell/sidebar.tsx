"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { sectionsFor, isActive, type NavItem, type NavSection } from "./nav-items";

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

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
        {sections.map((section, i) =>
          section.heading ? (
            <CollapsibleSection key={i} section={section} pathname={pathname} />
          ) : (
            <div key={i} className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
              ))}
            </div>
          ),
        )}
      </nav>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-primary-muted font-medium text-primary"
          : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
      )}
    >
      {/* Left accent bar marks the active route (premium sidebar idiom). */}
      <span
        className={cn(
          "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-primary" : "text-foreground-subtle group-hover:text-foreground",
        )}
      />
      {item.label}
    </Link>
  );
}

// A section with a heading (e.g. "Admin") renders as a collapsible group — collapsed by default so
// the operator's own account nav stays front-and-centre, with the back-office tucked away until
// clicked. Open/closed persists across navigations + reloads.
function CollapsibleSection({ section, pathname }: { section: NavSection; pathname: string }) {
  const storageKey = `nav:section:${section.heading}`;
  const [open, setOpen] = useState(false);

  // Default collapsed (matches SSR); hydrate the saved preference after mount to avoid a mismatch.
  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === "open") setOpen(true);
    } catch {
      // ignore
    }
  }, [storageKey]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, next ? "open" : "closed");
      } catch {
        // ignore
      }
      return next;
    });
  }

  const hasActiveChild = section.items.some((item) => isActive(pathname, item.href));

  return (
    <div className="mt-3 flex flex-col gap-0.5 border-t border-border-subtle pt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="group flex items-center justify-between rounded-md px-3 py-1.5 text-micro font-semibold uppercase tracking-wider text-foreground-subtle transition-colors hover:text-foreground"
      >
        <span className="flex items-center gap-1.5">
          {section.heading}
          {/* Dot hint when the section is collapsed but you're on one of its pages. */}
          {!open && hasActiveChild && <span className="size-1.5 rounded-full bg-primary" />}
        </span>
        <ChevronDown
          className={cn("size-3.5 transition-transform duration-200", open ? "rotate-0" : "-rotate-90")}
        />
      </button>

      {/* grid-rows 1fr↔0fr gives a smooth height collapse without measuring the content. */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-0.5 pt-0.5">
            {section.items.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
