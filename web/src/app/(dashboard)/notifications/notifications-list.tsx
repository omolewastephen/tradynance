"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
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
import { Card } from "@/components/ui/card";
import { markNotificationRead, markAllNotificationsRead } from "./actions";

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

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationsList({
  items: initial,
  initialUnread,
}: {
  items: Notif[];
  initialUnread: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [unread, setUnread] = useState(initialUnread);
  const [, startTransition] = useTransition();

  function readOne(id: string) {
    const target = items.find((n) => n.id === id);
    if (!target || target.read) return;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  }

  function readAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-foreground-muted">
        No notifications yet. Deposits, trades, withdrawals and other account activity will show up
        here.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {unread > 0 && (
        <button
          onClick={readAll}
          className="self-end text-xs text-accent hover:underline"
        >
          Mark all read
        </button>
      )}
      <div className="overflow-hidden rounded-md border border-border bg-surface">
        {items.map((n) => {
          const Icon = ICONS[n.type] ?? Info;
          return (
            <button
              key={n.id}
              onClick={() => readOne(n.id)}
              className={cn(
                "flex w-full gap-3 border-b border-border-subtle px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-raised",
                !n.read && "bg-primary/[0.04]",
              )}
            >
              <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-border-subtle text-foreground-muted">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className="shrink-0 text-[11px] text-foreground-muted/70">
                    {when(n.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-foreground-muted">{n.body}</p>
              </div>
              {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
