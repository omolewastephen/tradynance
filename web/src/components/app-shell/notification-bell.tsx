"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Bell,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Gauge,
  Users,
  Coins,
  ShieldCheck,
  Info,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { markAllNotificationsRead } from "@/app/(dashboard)/notifications/actions";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

const ICONS: Record<string, LucideIcon> = {
  DEPOSIT: ArrowDownToLine,
  WITHDRAWAL: ArrowUpFromLine,
  TRADE: ArrowLeftRight,
  LIQUIDATION: Gauge,
  REFERRAL: Users,
  STAKING: Coins,
  LAUNCHPAD: Coins,
  SECURITY: ShieldCheck,
  SYSTEM: Info,
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as { items: Notif[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      /* transient */
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, []);

  // close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function markAll() {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    startTransition(async () => {
      await markAllNotificationsRead();
      load();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative grid size-9 place-items-center rounded-full border border-border-subtle bg-surface text-foreground-muted transition-colors hover:text-foreground"
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-30 w-80 overflow-hidden rounded-md border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-foreground-muted">
                No notifications yet.
              </p>
            ) : (
              items.map((n) => {
                const Icon = ICONS[n.type] ?? Info;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex gap-3 border-b border-border-subtle px-3 py-2.5 last:border-0",
                      !n.read && "bg-primary/[0.04]",
                    )}
                  >
                    <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-border-subtle text-foreground-muted">
                      <Icon className="size-[15px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{n.title}</span>
                        {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-foreground-muted">{n.body}</p>
                      <span className="mt-1 block text-[11px] text-foreground-muted/70">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border-subtle px-3 py-2.5 text-center text-sm text-accent hover:bg-surface-raised"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
