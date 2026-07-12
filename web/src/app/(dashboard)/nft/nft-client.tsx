"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { nftArtDataUri } from "@/lib/nft-art";
import { Input } from "@/components/ui/input";
import { buyNftAction, listNftAction, cancelListingAction } from "./actions";

export type ListingVM = {
  listingId: string;
  nftId: string;
  name: string;
  collection: string;
  imageSeed: string;
  price: number;
  seller: string;
  mine: boolean;
};

export type OwnedVM = {
  nftId: string;
  name: string;
  collection: string;
  imageSeed: string;
  listedPrice: number | null;
  listingId: string | null;
};

function usd(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Art({ seed, name }: { seed: string; name: string }) {
  // Deterministic generated SVG as a data URI — no external image assets.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={nftArtDataUri(seed)} alt={name} className="aspect-square w-full object-cover" />;
}

export function NftClient({
  listings,
  owned,
  available,
}: {
  listings: ListingVM[];
  owned: OwnedVM[];
  available: number;
}) {
  const [tab, setTab] = useState<"market" | "mine">("market");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 border-b border-border text-sm">
        <TabBtn active={tab === "market"} onClick={() => setTab("market")}>
          Marketplace ({listings.length})
        </TabBtn>
        <TabBtn active={tab === "mine"} onClick={() => setTab("mine")}>
          My NFTs ({owned.length})
        </TabBtn>
        <span className="ml-auto self-center text-xs text-foreground-muted">
          Balance: <span className="font-mono tabular-nums text-foreground">{usd(available)} USDT</span>
        </span>
      </div>

      {tab === "market" ? (
        listings.length === 0 ? (
          <Empty>No active listings right now.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((l) => (
              <MarketCard key={l.listingId} l={l} canAfford={available >= l.price} />
            ))}
          </div>
        )
      ) : owned.length === 0 ? (
        <Empty>You don&apos;t own any NFTs yet. Buy one from the marketplace.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {owned.map((n) => (
            <OwnedCard key={n.nftId} n={n} />
          ))}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "-mb-px border-b-2 pb-2 pt-1 transition-colors",
        active ? "border-primary font-medium text-foreground" : "border-transparent text-foreground-muted",
      )}
    >
      {children}
    </button>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-md border border-border bg-surface">{children}</div>;
}

function MarketCard({ l, canAfford }: { l: ListingVM; canAfford: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setMsg(res.error ?? "Failed");
    });
  }

  return (
    <CardShell>
      <Art seed={l.imageSeed} name={l.name} />
      <div className="flex flex-col gap-2 p-3">
        <div>
          <div className="text-sm font-medium">{l.name}</div>
          <div className="text-xs text-foreground-muted">{l.collection}</div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-micro uppercase tracking-wide text-foreground-muted">Price</div>
            <div className="font-mono text-sm font-semibold tabular-nums">{usd(l.price)} USDT</div>
          </div>
          {l.mine ? (
            <button
              onClick={() => act(() => cancelListingAction(l.listingId))}
              disabled={pending}
              className="rounded-sm border border-border px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:border-danger/50 hover:text-danger disabled:opacity-50"
            >
              {pending ? "…" : "Unlist"}
            </button>
          ) : (
            <button
              onClick={() => act(() => buyNftAction(l.listingId))}
              disabled={pending || !canAfford}
              title={!canAfford ? "Insufficient USDT" : undefined}
              className="rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? "…" : canAfford ? "Buy" : "Low bal"}
            </button>
          )}
        </div>
        {l.mine && <div className="text-[11px] text-foreground-muted/70">Your listing</div>}
        {msg && <p className="text-xs text-danger">{msg}</p>}
      </div>
    </CardShell>
  );
}

function OwnedCard({ n }: { n: OwnedVM }) {
  const router = useRouter();
  const [price, setPrice] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function list() {
    setMsg(null);
    start(async () => {
      const res = await listNftAction(n.nftId, price);
      if (res.ok) {
        setPrice("");
        router.refresh();
      } else setMsg(res.error);
    });
  }
  function unlist() {
    if (!n.listingId) return;
    start(async () => {
      const res = await cancelListingAction(n.listingId!);
      if (res.ok) router.refresh();
      else setMsg(res.error);
    });
  }

  return (
    <CardShell>
      <Art seed={n.imageSeed} name={n.name} />
      <div className="flex flex-col gap-2 p-3">
        <div>
          <div className="text-sm font-medium">{n.name}</div>
          <div className="text-xs text-foreground-muted">{n.collection}</div>
        </div>
        {n.listedPrice != null ? (
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm tabular-nums text-primary">Listed · {usd(n.listedPrice)} USDT</span>
            <button
              onClick={unlist}
              disabled={pending}
              className="rounded-sm border border-border px-2.5 py-1 text-xs text-foreground-muted transition-colors hover:border-danger/50 hover:text-danger disabled:opacity-50"
            >
              {pending ? "…" : "Unlist"}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder="Price USDT"
              className="h-8 font-mono text-xs"
            />
            <button
              onClick={list}
              disabled={pending || Number(price) <= 0}
              className="shrink-0 rounded-sm bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? "…" : "List"}
            </button>
          </div>
        )}
        {msg && <p className="text-xs text-danger">{msg}</p>}
      </div>
    </CardShell>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface px-4 py-12 text-center text-sm text-foreground-muted">
      {children}
    </div>
  );
}
