import { HydrationBoundary } from "@tanstack/react-query";
import { OverviewScreen } from "@/features/admin/dashboard/screens/overview/OverviewScreen";
import { fetchDashboard } from "@/features/admin/dashboard/screens/overview/logic/api";
import { prefetchQueryState } from "@/shared/services/prefetch";
import { queryKeys } from "@/shared/services/queryKeys";

/**
 * The dashboard is the landing screen for every admin session, so its
 * time-to-data is the number users perceive as "is this app fast". It is the
 * first screen converted to server prefetch + hydrate (audit H-5): the KPI query
 * runs during this render instead of after the bundle hydrates, removing one full
 * round trip from the critical path.
 *
 * `OverviewScreen` is unchanged — `useDashboard()` finds the data already in the
 * cache. If the prefetch fails it falls back to fetching client-side exactly as
 * before, so this cannot make the screen worse than it was.
 */
export default async function Page() {
  const state = await prefetchQueryState(queryKeys.dashboard.overview, fetchDashboard);

  return (
    <HydrationBoundary state={state}>
      <OverviewScreen />
    </HydrationBoundary>
  );
}
