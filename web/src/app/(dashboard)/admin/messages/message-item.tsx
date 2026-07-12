"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { setMessageStatus } from "./actions";

export type MessageVM = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "NEW" | "READ" | "ARCHIVED";
  createdAt: string;
};

export function MessageItem({ m }: { m: MessageVM }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function set(status: "READ" | "ARCHIVED") {
    start(async () => {
      await setMessageStatus(m.id, status);
      router.refresh();
    });
  }

  function toggle() {
    setOpen((o) => !o);
    if (!open && m.status === "NEW") set("READ");
  }

  return (
    <div className={cn("border-t border-border-subtle first:border-t-0", m.status === "NEW" && "bg-primary/[0.03]")}>
      <button onClick={toggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        {m.status === "NEW" ? (
          <span className="size-2 shrink-0 rounded-full bg-primary" />
        ) : (
          <span className="size-2 shrink-0 rounded-full border border-border" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-sm", m.status === "NEW" ? "font-medium" : "")}>{m.subject}</span>
            <span className="shrink-0 text-xs text-foreground-subtle">
              {new Date(m.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="truncate text-xs text-foreground-muted">
            {m.name} · {m.email}
          </div>
        </div>
        {m.status === "ARCHIVED" && <span className="text-xs text-foreground-subtle">Archived</span>}
      </button>

      {open && (
        <div className="px-4 pb-4 pl-9">
          <p className="whitespace-pre-wrap rounded-sm border border-border-subtle bg-surface-raised p-3 text-sm text-foreground-muted">
            {m.message}
          </p>
          <div className="mt-2 flex gap-3 text-xs">
            <a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`} className="text-accent hover:underline">
              Reply by email
            </a>
            {m.status !== "ARCHIVED" && (
              <button onClick={() => set("ARCHIVED")} disabled={pending} className="text-foreground-muted hover:text-foreground disabled:opacity-50">
                Archive
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
