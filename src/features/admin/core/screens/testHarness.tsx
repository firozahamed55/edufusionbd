import { vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { axe } from "vitest-axe";
import type { ReactElement } from "react";
import { ToastProvider } from "@/shared/ui";

/**
 * The harness that lets a Settings screen be rendered in a test at all.
 *
 * WHY IT DID NOT EXIST. The module had two test files, both pure logic, and
 * zero screen tests (audit M-12) — in a module where a wrong value silently
 * corrupts exam processing for a whole cohort. The reason nobody wrote one is
 * mechanical rather than philosophical: a screen needs a Supabase client, a
 * query client, a toast provider, a locale and a router before it renders one
 * pixel, and wiring five of those per test file is enough friction to stop
 * anyone. This is that wiring, once.
 *
 * WHAT IT MOCKS AND WHY THAT IS HONEST. The Supabase client is replaced by a
 * table of canned responses keyed on table name and RPC name. That makes these
 * screen tests, not integration tests — they assert what the SCREEN does with
 * data and what it refuses to send, which is exactly where this module's
 * defects lived. What the DATABASE does with the payload is asserted in
 * `supabase/tests/rls_roles.test.sql`, and the two must not be conflated: a
 * mocked RPC that always succeeds would happily "prove" a guard that does not
 * exist.
 */

export type CannedRows = Record<string, unknown[]>;
export type CannedRpc = Record<string, unknown>;

/** Every write the screen attempted, in order. Assert against this. */
export type RpcLog = { fn: string; args: unknown }[];

/**
 * The mock's state lives on `globalThis` because every `vi.mock` factory below
 * is hoisted to the top of this module — it cannot close over a `const`
 * declared later in the file, and it cannot take a parameter.
 *
 * A test file gets all of this by importing this module BEFORE it imports a
 * screen (see the top-level `await import(...)` in the test files). Import
 * order is load-bearing: a screen imported first captures the real
 * `createClient` and every query goes to a Supabase URL that does not exist.
 */
type MockState = { rows: CannedRows; rpc: CannedRpc; log: RpcLog; rpcError: Record<string, string> };
const STATE_KEY = "__eduSupabaseMock" as const;

function state(): MockState {
  const g = globalThis as unknown as Record<string, MockState>;
  g[STATE_KEY] ??= { rows: {}, rpc: {}, log: [], rpcError: {} };
  return g[STATE_KEY];
}

/** Reset between tests, and load this test's canned data. */
export function seed({ rows = {}, rpc = {}, rpcError = {} }: { rows?: CannedRows; rpc?: CannedRpc; rpcError?: Record<string, string> }) {
  const s = state();
  s.rows = rows;
  s.rpc = rpc;
  s.rpcError = rpcError;
  s.log = [];
  return s.log;
}

/**
 * A `from()` builder that accepts every chained method the module uses and
 * resolves to the canned rows for that table. Deliberately permissive: the
 * point is to get the screen rendered, not to re-implement PostgREST.
 */
function builder(table: string) {
  const s = state();
  const result = { data: s.rows[table] ?? [], error: null, count: (s.rows[table] ?? []).length };
  const chain: Record<string, unknown> = {};
  const passthrough = [
    "select", "eq", "neq", "is", "in", "or", "order", "limit", "range", "gte", "lte", "not", "ilike", "filter",
  ];
  for (const m of passthrough) chain[m] = () => chain;
  chain.maybeSingle = () => Promise.resolve({ data: (s.rows[table] ?? [])[0] ?? null, error: null });
  chain.single = chain.maybeSingle;
  // `await`ing the builder itself is the common case (`.limit(...)` last).
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

vi.mock("@/shared/services/supabase/client", () => ({
  createClient: () => {
    const s = state();
    return {
      from: (table: string) => builder(table),
      rpc: (fn: string, args: unknown) => {
        s.log.push({ fn, args });
        if (s.rpcError[fn]) {
          return Promise.resolve({ data: null, error: { message: s.rpcError[fn], code: "P0001" } });
        }
        return Promise.resolve({ data: s.rpc[fn] ?? null, error: null });
      },
      auth: { resetPasswordForEmail: () => Promise.resolve({ error: null }) },
      storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) },
    };
  },
}));

/**
 * next-intl's locale, next/navigation, and the academic-year context.
 *
 * Registered at module scope, not inside a function: `vi.mock` is hoisted to
 * the top of whichever module contains it, and vitest warns (soon errors) when
 * the call sits inside a function body, because the written order then lies
 * about the execution order.
 *
 * The locale goes through `globalThis` for the same reason the Supabase state
 * does — a hoisted factory cannot close over a parameter that does not exist
 * yet. Call `setLocale("bn")` to re-render a screen in Bangla.
 */
vi.mock("next-intl", () => ({
  useLocale: () => (globalThis as unknown as Record<string, string>).__eduLocale ?? "en",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => {}, push: () => {}, refresh: () => {} }),
  usePathname: () => "/admin/core",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/shared/services/academicYear/hooks", () => ({
  useCurrentYearId: () => "00000000-0000-4000-8000-000000000001",
  useAcademicYear: () => ({ yearId: "00000000-0000-4000-8000-000000000001", isArchived: false }),
}));

export function setLocale(locale: "bn" | "en") {
  (globalThis as unknown as Record<string, string>).__eduLocale = locale;
}

/**
 * `retry: false` matters more than it looks: with the default retry policy a
 * screen under test that hits a mocked error sits in `isLoading` for three
 * attempts and the assertion times out on a failure that is actually correct.
 */
export function renderScreen(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

/**
 * Zero axe violations, with the rules that a fragment-in-jsdom cannot satisfy
 * switched off rather than silently passing.
 *
 * `region` wants every node inside a landmark; the screens render inside the
 * admin shell's `<main>`, which is not mounted here. `color-contrast` needs a
 * layout engine jsdom does not have — that floor is held by
 * `src/app/contrast.test.ts`, which checks the tokens directly.
 */
export async function expectNoAxeViolations(container: HTMLElement) {
  const results = await axe(container, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  });
  const violations = results.violations ?? [];
  if (violations.length > 0) {
    const detail = violations
      .map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((nd) => nd.html).join("\n  ")}`)
      .join("\n");
    throw new Error(`${violations.length} accessibility violation(s):\n${detail}`);
  }
}
