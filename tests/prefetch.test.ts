/**
 * Guards the H-5 prefetch against the one failure mode that is otherwise silent.
 *
 * A Server Component that imports a value from a `"use client"` module receives a
 * client-reference stub, so the import is `undefined` at runtime with no error.
 * That happened while building this feature: the query key was exported from the
 * hook file, arrived as `undefined` on the server, and the prefetched data
 * dehydrated under key `undefined`. Nothing failed — the client hook simply never
 * matched it and fetched again, so the "optimisation" added a query per page load
 * while appearing to work.
 *
 * `prefetchQueryState` therefore throws on a bad key rather than proceeding.
 */
import { describe, it, expect, vi } from "vitest";

// The real server client needs `next/headers`, which has no request scope here.
// The key check runs before it is touched, which is the point being asserted.
vi.mock("@/shared/services/supabase/server", () => ({
  createClient: async () => ({}),
}));

const { prefetchQueryState } = await import("@/shared/services/prefetch");

const noop = async () => ({ ok: true });

describe("prefetchQueryState key validation", () => {
  it("rejects an undefined key — the client-module import bug", async () => {
    await expect(
      prefetchQueryState(undefined as unknown as readonly unknown[], noop),
    ).rejects.toThrow(/invalid query key/i);
  });

  it("names the actual cause in the message, so the fix is obvious", async () => {
    await expect(
      prefetchQueryState(undefined as unknown as readonly unknown[], noop),
    ).rejects.toThrow(/use client/);
  });

  it("rejects an empty key", async () => {
    await expect(prefetchQueryState([], noop)).rejects.toThrow(/invalid query key/i);
  });

  it("rejects a key with an undefined part", async () => {
    // e.g. `queryKeys.students.detail(someUndefinedId)` — hydrates under a key the
    // client will never reproduce.
    await expect(prefetchQueryState(["students", "detail", undefined], noop)).rejects.toThrow(
      /invalid query key/i,
    );
  });

  it("accepts a valid key and dehydrates the result under it", async () => {
    const state = await prefetchQueryState(["dashboard", "overview"], noop);
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0].queryKey).toEqual(["dashboard", "overview"]);
    expect(state.queries[0].state.data).toEqual({ ok: true });
  });

  it("passes the Supabase client to the query function", async () => {
    const seen: unknown[] = [];
    await prefetchQueryState(["x"], async (supabase) => {
      seen.push(supabase);
      return { ok: true };
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeDefined();
  });
});
