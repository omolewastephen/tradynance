"use client";

import { useState, useTransition } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createLaunchpadProject,
  updateLaunchpadProject,
  deleteLaunchpadProject,
} from "./actions";

export type ProjectRow = {
  id: string;
  name: string;
  tokenSymbol: string;
  saleSymbol: string;
  tokenPrice: string;
  totalAllocation: string;
  soldAllocation: string;
  minCommit: string;
  maxCommit: string;
  startAt: string; // yyyy-MM-ddTHH:mm for datetime-local
  endAt: string;
  status: string;
  description: string;
  commitments: number;
};

const STATUSES = ["UPCOMING", "LIVE", "ENDED", "DISTRIBUTED"] as const;

const selectClass =
  "h-9 rounded-sm border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary/50";

export function NewProjectButton({ assets }: { assets: string[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New project
      </Button>
    );
  }
  return <ProjectFields assets={assets} onDone={() => setOpen(false)} />;
}

export function ProjectFields({
  assets,
  project,
  onDone,
}: {
  assets: string[];
  project?: ProjectRow;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(project);
  const uid = project?.id ?? "new";

  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const r = editing ? await updateLaunchpadProject(fd) : await createLaunchpadProject(fd);
          if (r.ok) onDone();
          else setError(r.error);
        });
      }}
      className="flex flex-col gap-4 rounded-md border border-border-subtle bg-surface-raised p-4"
    >
      {project && <input type="hidden" name="id" value={project.id} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`name-${uid}`}>Project name</Label>
          <Input id={`name-${uid}`} name="name" defaultValue={project?.name} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`token-${uid}`}>Token sold</Label>
          <select
            id={`token-${uid}`}
            name="tokenSymbol"
            defaultValue={project?.tokenSymbol ?? assets[0]}
            className={selectClass}
          >
            {assets.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`sale-${uid}`}>Paid with</Label>
          <select
            id={`sale-${uid}`}
            name="saleSymbol"
            defaultValue={project?.saleSymbol ?? "USDT"}
            className={selectClass}
          >
            {assets.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`price-${uid}`}>Token price</Label>
          <Input
            id={`price-${uid}`}
            name="tokenPrice"
            inputMode="decimal"
            defaultValue={project?.tokenPrice ?? "0.10"}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`alloc-${uid}`}>Total allocation (tokens)</Label>
          <Input
            id={`alloc-${uid}`}
            name="totalAllocation"
            inputMode="decimal"
            defaultValue={project?.totalAllocation ?? "1000000"}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`status-${uid}`}>Status</Label>
          <select
            id={`status-${uid}`}
            name="status"
            defaultValue={project?.status ?? "UPCOMING"}
            className={selectClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`min-${uid}`}>Min commit</Label>
          <Input
            id={`min-${uid}`}
            name="minCommit"
            inputMode="decimal"
            defaultValue={project?.minCommit ?? "10"}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`max-${uid}`}>Max commit (per user)</Label>
          <Input
            id={`max-${uid}`}
            name="maxCommit"
            inputMode="decimal"
            defaultValue={project?.maxCommit ?? "1000"}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`start-${uid}`}>Starts</Label>
          <Input
            id={`start-${uid}`}
            name="startAt"
            type="datetime-local"
            defaultValue={project?.startAt}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`end-${uid}`}>Ends</Label>
          <Input
            id={`end-${uid}`}
            name="endAt"
            type="datetime-local"
            defaultValue={project?.endAt}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`desc-${uid}`}>Description</Label>
        <textarea
          id={`desc-${uid}`}
          name="description"
          rows={3}
          defaultValue={project?.description}
          required
          className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          <Save className="size-4" />
          {isPending ? "Saving…" : editing ? "Save changes" : "Create project"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone} disabled={isPending}>
          <X className="size-4" />
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ProjectRowItem({ project, assets }: { project: ProjectRow; assets: string[] }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return <ProjectFields assets={assets} project={project} onDone={() => setEditing(false)} />;
  }

  const pct =
    Number(project.totalAllocation) > 0
      ? (Number(project.soldAllocation) / Number(project.totalAllocation)) * 100
      : 0;

  return (
    <div className="flex flex-col gap-2 border-b border-border-subtle py-3 last:border-0 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">{project.name}</span>
          <span className="rounded-full border border-border-subtle px-2 py-0.5 text-xs font-mono text-foreground-muted">
            {project.tokenSymbol} / {project.saleSymbol}
          </span>
          <span className="rounded-full border border-border-subtle px-2 py-0.5 text-xs text-foreground-muted">
            {project.status}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 text-xs text-foreground-muted">
          <span>@ {project.tokenPrice}</span>
          <span>
            {project.soldAllocation} / {project.totalAllocation} sold ({pct.toFixed(1)}%)
          </span>
          <span>{project.commitments} commitment(s)</span>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <form
          action={(fd) => {
            setError(null);
            startTransition(async () => {
              const r = await deleteLaunchpadProject(fd);
              if (!r.ok) setError(r.error);
            });
          }}
        >
          <input type="hidden" name="id" value={project.id} />
          <Button type="submit" size="sm" variant="ghost" disabled={isPending}>
            <Trash2 className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
