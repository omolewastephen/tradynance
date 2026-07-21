"use client";

import { useState, useTransition } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStakingProduct, updateStakingProduct, deleteStakingProduct } from "./actions";

export type ProductRow = {
  id: string;
  assetSymbol: string;
  name: string;
  aprPercent: string;
  lockDays: number;
  minStake: string;
  isActive: boolean;
  positions: number;
};

export function NewProductForm({ assets }: { assets: string[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New product
      </Button>
    );
  }
  return <ProductFields assets={assets} onDone={() => setOpen(false)} />;
}

export function ProductFields({
  assets,
  product,
  onDone,
}: {
  assets: string[];
  product?: ProductRow;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(product);

  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const r = editing ? await updateStakingProduct(fd) : await createStakingProduct(fd);
          if (r.ok) onDone();
          else setError(r.error);
        });
      }}
      className="flex flex-col gap-4 rounded-md border border-border-subtle bg-surface-raised p-4"
    >
      {product && <input type="hidden" name="id" value={product.id} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`asset-${product?.id ?? "new"}`}>Asset</Label>
          <select
            id={`asset-${product?.id ?? "new"}`}
            name="assetSymbol"
            defaultValue={product?.assetSymbol ?? assets[0]}
            className="h-9 rounded-sm border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary/50"
          >
            {assets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`name-${product?.id ?? "new"}`}>Product name</Label>
          <Input
            id={`name-${product?.id ?? "new"}`}
            name="name"
            defaultValue={product?.name}
            placeholder="e.g. BTC Flexible"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`apr-${product?.id ?? "new"}`}>APR (%)</Label>
          <Input
            id={`apr-${product?.id ?? "new"}`}
            name="aprPercent"
            inputMode="decimal"
            defaultValue={product?.aprPercent ?? "5"}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`lock-${product?.id ?? "new"}`}>Lock days (0 = flexible)</Label>
          <Input
            id={`lock-${product?.id ?? "new"}`}
            name="lockDays"
            inputMode="numeric"
            defaultValue={String(product?.lockDays ?? 0)}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`min-${product?.id ?? "new"}`}>Minimum stake</Label>
          <Input
            id={`min-${product?.id ?? "new"}`}
            name="minStake"
            inputMode="decimal"
            defaultValue={product?.minStake ?? "0.01"}
            required
          />
        </div>

        <div className="flex items-end gap-2 pb-1">
          <input
            id={`active-${product?.id ?? "new"}`}
            type="checkbox"
            name="isActive"
            defaultChecked={product?.isActive ?? true}
            className="size-4 accent-[var(--primary)]"
            suppressHydrationWarning
          />
          <Label htmlFor={`active-${product?.id ?? "new"}`} className="font-normal">
            Active (visible to users)
          </Label>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          <Save className="size-4" />
          {isPending ? "Saving…" : editing ? "Save changes" : "Create product"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone} disabled={isPending}>
          <X className="size-4" />
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ProductRowItem({ product, assets }: { product: ProductRow; assets: string[] }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return <ProductFields assets={assets} product={product} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border-subtle py-3 last:border-0 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">{product.name}</span>
          <span className="rounded-full border border-border-subtle px-2 py-0.5 text-xs font-mono text-foreground-muted">
            {product.assetSymbol}
          </span>
          <span className="font-mono text-sm text-primary">{product.aprPercent}% APR</span>
          {!product.isActive && (
            <span className="rounded-full border border-border-subtle px-2 py-0.5 text-xs text-foreground-subtle">
              Inactive
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 text-xs text-foreground-muted">
          <span>{product.lockDays === 0 ? "Flexible" : `${product.lockDays}-day lock`}</span>
          <span>Min {product.minStake}</span>
          <span>{product.positions} position(s)</span>
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
              const r = await deleteStakingProduct(fd);
              if (!r.ok) setError(r.error);
            });
          }}
        >
          <input type="hidden" name="id" value={product.id} />
          <Button type="submit" size="sm" variant="ghost" disabled={isPending}>
            <Trash2 className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
