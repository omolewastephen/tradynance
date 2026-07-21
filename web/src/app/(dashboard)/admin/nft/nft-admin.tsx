"use client";

import { useState, useTransition } from "react";
import { Plus, Save, Sparkles, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCollection,
  updateCollection,
  deleteCollection,
  mintNft,
} from "./actions";

export type CollectionRow = {
  id: string;
  name: string;
  symbol: string;
  description: string;
  nfts: number;
};

const inputBase =
  "rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50";

export function NewCollectionButton() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New collection
      </Button>
    );
  }
  return <CollectionFields onDone={() => setOpen(false)} />;
}

function CollectionFields({
  collection,
  onDone,
}: {
  collection?: CollectionRow;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(collection);
  const uid = collection?.id ?? "new";

  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const r = editing ? await updateCollection(fd) : await createCollection(fd);
          if (r.ok) onDone();
          else setError(r.error);
        });
      }}
      className="flex flex-col gap-4 rounded-md border border-border-subtle bg-surface-raised p-4"
    >
      {collection && <input type="hidden" name="id" value={collection.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`cname-${uid}`}>Collection name</Label>
          <Input id={`cname-${uid}`} name="name" defaultValue={collection?.name} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`csym-${uid}`}>Symbol</Label>
          <Input
            id={`csym-${uid}`}
            name="symbol"
            defaultValue={collection?.symbol}
            placeholder="e.g. TDYART"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`cdesc-${uid}`}>Description</Label>
        <textarea
          id={`cdesc-${uid}`}
          name="description"
          rows={2}
          defaultValue={collection?.description}
          required
          className={inputBase}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          <Save className="size-4" />
          {isPending ? "Saving…" : editing ? "Save changes" : "Create collection"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone} disabled={isPending}>
          <X className="size-4" />
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function CollectionRowItem({ collection }: { collection: CollectionRow }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (editing) return <CollectionFields collection={collection} onDone={() => setEditing(false)} />;

  return (
    <div className="flex flex-col gap-2 border-b border-border-subtle py-3 last:border-0 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">{collection.name}</span>
          <span className="rounded-full border border-border-subtle px-2 py-0.5 text-xs font-mono text-foreground-muted">
            {collection.symbol}
          </span>
          <span className="text-xs text-foreground-muted">{collection.nfts} minted</span>
        </div>
        <p className="line-clamp-1 text-xs text-foreground-muted">{collection.description}</p>
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
              const r = await deleteCollection(fd);
              if (!r.ok) setError(r.error);
            });
          }}
        >
          <input type="hidden" name="id" value={collection.id} />
          <Button type="submit" size="sm" variant="ghost" disabled={isPending}>
            <Trash2 className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

export function MintForm({ collections }: { collections: CollectionRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (collections.length === 0) {
    return (
      <p className="text-sm text-foreground-muted">
        Create a collection first — NFTs are minted into one.
      </p>
    );
  }

  return (
    <form
      action={(fd) => {
        setMsg(null);
        startTransition(async () => {
          const r = await mintNft(fd);
          setMsg(r.ok ? { ok: true, text: "Minted." } : { ok: false, text: r.error });
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mint-collection">Collection</Label>
          <select id="mint-collection" name="collectionId" className={`h-9 ${inputBase}`}>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.symbol})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mint-name">NFT name</Label>
          <Input id="mint-name" name="name" placeholder="e.g. Onyx #1" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mint-owner">Owner email</Label>
          <Input id="mint-owner" name="ownerEmail" type="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mint-seed">
            Art seed <span className="text-foreground-subtle">(optional)</span>
          </Label>
          <Input id="mint-seed" name="imageSeed" placeholder="auto" />
        </div>
      </div>

      {msg && <p className={`text-sm ${msg.ok ? "text-primary" : "text-danger"}`}>{msg.text}</p>}

      <Button type="submit" size="sm" disabled={isPending} className="w-fit">
        <Sparkles className="size-4" />
        {isPending ? "Minting…" : "Mint NFT"}
      </Button>
    </form>
  );
}
