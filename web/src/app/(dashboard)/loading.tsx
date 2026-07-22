import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-group skeleton: shown instantly inside the app shell while ANY dashboard/admin page's
 * server component is fetching. Shaped like the common page anatomy (title → hero card → stat
 * row → content cards) so the swap to real content is spatially calm rather than a flash from
 * blank. One file covers every child route — pages with a more specific loading.tsx can override.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading page">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Skeleton className="h-44 w-full" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-72 lg:col-span-3" />
        <Skeleton className="h-72 lg:col-span-2" />
      </div>
    </div>
  );
}
