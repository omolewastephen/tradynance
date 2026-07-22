import { Skeleton } from "@/components/ui/skeleton";

/** Marketing pages fetch live tickers + CMS copy server-side; show structure instead of blank. */
export default function MarketingLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16" aria-busy="true" aria-label="Loading page">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5">
        <Skeleton className="h-6 w-40 rounded-full" />
        <Skeleton className="h-14 w-full max-w-xl" />
        <Skeleton className="h-5 w-3/4" />
        <div className="flex gap-3">
          <Skeleton className="h-11 w-36" />
          <Skeleton className="h-11 w-32" />
        </div>
      </div>
      <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}
