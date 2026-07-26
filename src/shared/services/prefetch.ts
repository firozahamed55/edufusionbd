import { QueryClient, dehydrate, type DehydratedState } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/server";
import type { BrowserClient } from "@/shared/services/supabase/types";

/**
 * Server-side prefetch for a screen's first-paint query (audit H-5).
 *
 * THE PROBLEM. A fresh screen cost three SEQUENTIAL round trips: middleware
 * verifies the JWT, *then* the server renders the page, *then* the client screen
 * mounts and TanStack Query fires its fetch. Time-to-data was the SUM of all
 * three rather than the max — and the third hop could not even start until the
 * JS bundle had downloaded and hydrated. On the 3G-ish connections a rural
 * Bangladeshi school actually has, that last hop dominates.
 *
 * THE FIX. Run the query on the server, during the render we were already paying
 * for, and ship the result inside the HTML. The client hook then finds the data
 * already in its cache and renders it on the first paint with no fetch at all.
 *
 * WHY THIS IS SAFE TO ADD SCREEN BY SCREEN. `prefetchQuery` does not throw — a
 * failed prefetch simply dehydrates nothing and the client fetches as before. So
 * a prefetch that breaks degrades to the old behaviour instead of 500ing the page,
 * which is what makes it reasonable to roll out incrementally rather than all 55
 * screens at once.
 *
 * THE ONE RULE: `key` must be byte-identical to the key the client hook uses. A
 * mismatched key is invisible — the page still works, it just silently double
 * fetches, i.e. it costs more than doing nothing. Keys live in the hook next to
 * their `useQuery`, and each prefetching page imports the same constant.
 */
export async function prefetchQueryState(
  key: readonly unknown[],
  query: (supabase: BrowserClient) => Promise<unknown>,
): Promise<DehydratedState> {
  assertPrefetchKey(key);

  const queryClient = new QueryClient();
  // The server client reads the same session cookie the middleware just
  // refreshed, so RLS scopes this to exactly the rows the user would have got.
  //
  // The cast is the LAST `as unknown as` in the codebase and it is structural,
  // not a type-safety escape: `query` is written against `BrowserClient`
  // because that is what the feature `api.ts` functions take, and the server
  // and browser clients differ only in how they reach cookies. Both are
  // `SupabaseClient<Database, "public">`.
  const supabase = (await createClient()) as unknown as BrowserClient;
  await queryClient.prefetchQuery({ queryKey: key, queryFn: () => query(supabase) });
  return dehydrate(queryClient);
}

/**
 * Fail loudly on the one mistake that is otherwise invisible.
 *
 * This bit during implementation: the key was exported from the `"use client"`
 * hook module and imported by the Server Component page. Next resolves that to a
 * client-reference stub, so `key` was `undefined` at runtime — no error, no
 * warning from our code. The query ran, the data dehydrated under key
 * `undefined`, the client hook found nothing, and the screen fetched again. The
 * "optimisation" cost an extra query per page load and looked like it worked.
 *
 * A thrown error in the RSC is the right response: it is caught by `error.tsx`,
 * it is impossible to miss in dev, and there is no scenario in which prefetching
 * under a broken key is better than not prefetching.
 */
function assertPrefetchKey(key: readonly unknown[]): void {
  if (!Array.isArray(key) || key.length === 0 || key.some((part) => part === undefined)) {
    throw new Error(
      `prefetchQueryState: invalid query key ${JSON.stringify(key) ?? "undefined"}. ` +
        `Query keys must come from a module WITHOUT "use client" — importing one from a ` +
        `client module gives a Server Component undefined. See shared/services/queryKeys.ts.`,
    );
  }
}
