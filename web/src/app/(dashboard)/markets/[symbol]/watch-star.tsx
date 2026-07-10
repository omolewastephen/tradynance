"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { toggleWatchlist } from "../watchlist-actions";

export function WatchStar({
  symbol,
  initialWatched,
}: {
  symbol: string;
  initialWatched: boolean;
}) {
  const [watched, setWatched] = useState(initialWatched);
  const [, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        setWatched((w) => !w);
        startTransition(() => {
          void toggleWatchlist(symbol);
        });
      }}
      className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
      aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
    >
      <Star className={cn("size-4", watched && "fill-warning text-warning")} />
      {watched ? "Watching" : "Watch"}
    </button>
  );
}
