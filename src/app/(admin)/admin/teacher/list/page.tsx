import { HydrationBoundary } from "@tanstack/react-query";
import { ListScreen } from "@/features/admin/teacher/screens/list/ListScreen";
import {
  fetchTeachers,
  TEACHER_LIST_FIRST_PAINT,
} from "@/features/admin/teacher/screens/list/logic/api";
import { prefetchQueryState } from "@/shared/services/prefetch";
import { queryKeys } from "@/shared/services/queryKeys";

/**
 * The heaviest list screen: two parallel Supabase queries (paged teachers +
 * class-teacher flags) that previously could not start until the JS bundle had
 * downloaded and hydrated. Prefetched on the server (audit H-5).
 *
 * Only the FIRST-PAINT query is prefetched — page 2, a search term or a department
 * filter are user actions and belong on the client. Prefetching those would be
 * guessing, and every wrong guess is a query the server paid for and nobody read.
 */
export default async function Page() {
  const state = await prefetchQueryState(
    queryKeys.teachers.list(TEACHER_LIST_FIRST_PAINT),
    (supabase) => fetchTeachers(supabase, TEACHER_LIST_FIRST_PAINT),
  );

  return (
    <HydrationBoundary state={state}>
      <ListScreen />
    </HydrationBoundary>
  );
}
