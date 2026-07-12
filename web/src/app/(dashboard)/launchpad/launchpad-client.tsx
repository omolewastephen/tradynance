"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { commitProject, claimProject } from "./actions";

export type ProjectVM = {
  id: string;
  name: string;
  tokenSymbol: string;
  saleSymbol: string;
  description: string;
  status: "UPCOMING" | "LIVE" | "ENDED" | "DISTRIBUTED";
  tokenPrice: number;
  totalAllocation: number;
  soldAllocation: number;
  minCommit: number;
  maxCommit: number;
  startAt: string;
  endAt: string;
  available: number;
  myCommitted: number;
  myTokens: number;
  myClaimed: boolean;
};

const STATUS_STYLE: Record<string, string> = {
  LIVE: "bg-primary/15 text-primary",
  UPCOMING: "bg-accent/15 text-accent",
  DISTRIBUTED: "bg-warning/15 text-warning",
  ENDED: "bg-border text-foreground-muted",
};

function fmt(n: number, dp = 2) {
  return n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function fmt0(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function LaunchpadClient({ projects }: { projects: ProjectVM[] }) {
  if (projects.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-foreground-muted">
        No launchpad projects yet.
      </Card>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {projects.map((p) => (
        <ProjectCard key={p.id} p={p} />
      ))}
    </div>
  );
}

function ProjectCard({ p }: { p: ProjectVM }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const progress = p.totalAllocation > 0 ? (p.soldAllocation / p.totalAllocation) * 100 : 0;
  const amt = Number(amount) || 0;
  const remainingForMe = Math.max(0, p.maxCommit - p.myCommitted);
  const invalid = amt > 0 && (amt < p.minCommit || amt > p.available || amt > remainingForMe);

  function commit() {
    setMsg(null);
    start(async () => {
      const res = await commitProject(p.id, amount);
      if (res.ok) {
        setMsg({ ok: true, text: `Committed ${amount} ${p.saleSymbol} → ${Number(res.tokenAmount).toFixed(2)} ${p.tokenSymbol}` });
        setAmount("");
        router.refresh();
      } else setMsg({ ok: false, text: res.error });
    });
  }

  function claim() {
    setMsg(null);
    start(async () => {
      const res = await claimProject(p.id);
      if (res.ok) {
        setMsg({ ok: true, text: `Claimed ${Number(res.tokenAmount).toFixed(2)} ${res.symbol}` });
        router.refresh();
      } else setMsg({ ok: false, text: res.error });
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-full bg-accent/10 text-accent">
            <Rocket className="size-5" />
          </div>
          <div>
            <div className="font-semibold">{p.name}</div>
            <div className="text-xs text-foreground-muted">
              {p.tokenSymbol} · {fmt(p.tokenPrice, p.tokenPrice < 1 ? 2 : 2)} {p.saleSymbol}/token
            </div>
          </div>
        </div>
        <span className={cn("rounded-xs px-2 py-0.5 text-[11px] font-semibold uppercase", STATUS_STYLE[p.status])}>
          {p.status}
        </span>
      </div>

      <p className="text-sm text-foreground-muted">{p.description}</p>

      {/* allocation progress */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-foreground-muted">
          <span>Sold</span>
          <span className="font-mono tabular-nums">
            {fmt0(p.soldAllocation)} / {fmt0(p.totalAllocation)} {p.tokenSymbol}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Meta label="Min / Max" value={`${fmt0(p.minCommit)} / ${fmt0(p.maxCommit)} ${p.saleSymbol}`} />
        <Meta label="Sale ends" value={new Date(p.endAt).toLocaleDateString()} />
      </div>

      {p.myCommitted > 0 && (
        <div className="rounded-sm border border-border-subtle bg-surface-raised/50 p-2.5 text-xs">
          <div className="flex justify-between">
            <span className="text-foreground-muted">Your commitment</span>
            <span className="font-mono tabular-nums">{fmt(p.myCommitted)} {p.saleSymbol}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground-muted">Your allocation</span>
            <span className="font-mono tabular-nums">
              {fmt(p.myTokens)} {p.tokenSymbol}{p.myClaimed ? " (claimed)" : ""}
            </span>
          </div>
        </div>
      )}

      {/* action per status */}
      {p.status === "LIVE" && (
        <div className="flex flex-col gap-2">
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder={`Amount in ${p.saleSymbol} (avail ${fmt(p.available)})`}
            className="font-mono"
          />
          <button
            onClick={commit}
            disabled={pending || amt <= 0 || invalid}
            className="rounded-sm bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? "Committing…" : invalid && amt < p.minCommit ? `Min ${fmt0(p.minCommit)} ${p.saleSymbol}` : invalid ? "Over limit / insufficient" : "Commit"}
          </button>
        </div>
      )}
      {p.status === "UPCOMING" && (
        <button disabled className="rounded-sm border border-border py-2 text-sm text-foreground-muted">
          Opens {new Date(p.startAt).toLocaleDateString()}
        </button>
      )}
      {p.status === "DISTRIBUTED" && p.myTokens > 0 && !p.myClaimed && (
        <button
          onClick={claim}
          disabled={pending}
          className="rounded-sm bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Claiming…" : `Claim ${fmt(p.myTokens)} ${p.tokenSymbol}`}
        </button>
      )}
      {p.status === "DISTRIBUTED" && (p.myTokens === 0 || p.myClaimed) && (
        <button disabled className="rounded-sm border border-border py-2 text-sm text-foreground-muted">
          {p.myClaimed ? "Claimed" : "Sale ended"}
        </button>
      )}
      {p.status === "ENDED" && (
        <button disabled className="rounded-sm border border-border py-2 text-sm text-foreground-muted">
          Sale ended
        </button>
      )}

      {msg && <p className={cn("text-xs", msg.ok ? "text-primary" : "text-danger")}>{msg.text}</p>}
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border-subtle px-2.5 py-1.5">
      <div className="text-micro uppercase tracking-wide text-foreground-muted">{label}</div>
      <div className="font-mono tabular-nums">{value}</div>
    </div>
  );
}
