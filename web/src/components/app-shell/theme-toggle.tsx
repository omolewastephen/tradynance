"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

// Dependency-free theme switch. The pre-paint script in the root layout sets data-theme before
// React hydrates (no flash); this just reads the resolved value, flips it, and persists the choice
// to localStorage so it survives reloads and is picked up by that script on the next visit.
function getCurrentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getCurrentTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // localStorage may be unavailable (private mode) — the in-page switch still works.
    }
    setTheme(next);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={cn(
        "relative grid size-9 place-items-center rounded-full border border-border-subtle bg-surface text-foreground-muted transition-colors hover:border-border hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {/* Both icons are rendered and crossfaded so there's no layout shift on toggle. Hidden until
          mounted to avoid showing the wrong icon for the pre-hydration (SSR-default) theme. */}
      <Sun
        className={cn(
          "absolute size-4 transition-all duration-200",
          mounted && !isDark ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0",
        )}
      />
      <Moon
        className={cn(
          "absolute size-4 transition-all duration-200",
          mounted && isDark ? "scale-100 rotate-0 opacity-100" : "scale-50 rotate-90 opacity-0",
        )}
      />
    </button>
  );
}
