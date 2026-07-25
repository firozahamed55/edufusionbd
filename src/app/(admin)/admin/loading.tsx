import { Skeleton } from "@/shared/ui";

/**
 * Suspense boundary for every /admin/* segment.
 *
 * Without this file the App Router has nothing to stream, so it holds the old
 * screen on-screen until the new segment's RSC payload has fully arrived — the
 * click registers as "nothing happened". With it, the shell swaps to this
 * skeleton on the very next frame and `<Link prefetch>` has a boundary it can
 * actually pre-render. Generic on purpose: it stands in for ~60 screens, so it
 * mimics the shared page frame (title, filter bar, table) rather than any one
 * screen's layout.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-3 w-80" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border-default bg-surface">
        <div className="border-b border-border-default bg-sunken px-5 py-3">
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <div className="flex flex-col gap-4 p-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
