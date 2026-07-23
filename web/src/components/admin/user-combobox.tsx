"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type UserHit = { id: string; email: string; username: string | null };

/**
 * Searchable user picker for admin forms (dependency-free "Select2"): type to search email or
 * username against /api/admin/users/search, pick with mouse or arrows+Enter. It IS the form
 * field — the input carries `name`, so a pasted full email works even without picking from the
 * list, and the server action still validates the address either way.
 */
export function UserCombobox({
  name,
  id,
  defaultValue = "",
  required,
}: {
  name: string;
  id: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [hits, setHits] = useState<UserHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState(defaultValue !== "");
  const rootRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search — skip once an option was explicitly picked (typing again re-enables).
  useEffect(() => {
    if (picked || value.trim().length < 1) {
      setHits([]);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    const q = value.trim();
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { users: UserHit[] };
        setHits(data.users);
        setOpen(data.users.length > 0);
        setActive(-1);
      } catch {
        /* search is a convenience — the field still works as a plain input */
      }
    }, 200);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [value, picked]);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function pick(hit: UserHit) {
    setValue(hit.email);
    setPicked(true);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <Input
        id={id}
        name={name}
        type="email"
        autoComplete="off"
        placeholder="Type to search email or username…"
        required={required}
        value={value}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        onChange={(e) => {
          setValue(e.target.value);
          setPicked(false);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault(); // select, don't submit the form
            pick(hits[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-sm border border-border bg-surface-raised shadow-elevation-2"
        >
          {hits.map((h, i) => (
            <li
              key={h.id}
              role="option"
              aria-selected={i === active}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm",
                i === active ? "bg-primary-muted text-foreground" : "text-foreground",
              )}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // don't blur the input first
                pick(h);
              }}
            >
              <span className="truncate">{h.email}</span>
              {h.username && (
                <span className="shrink-0 text-xs text-foreground-subtle">@{h.username}</span>
              )}
              {i === active && <Check className="size-3.5 shrink-0 text-primary" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
