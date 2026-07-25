/**
 * Central TanStack Query key factory. Prevents cache-key collisions across
 * features. Each feature composes on top of its domain namespace here.
 */
type Filters = Record<string, unknown> | undefined;

/**
 * NOTE — this module must never gain a `"use client"` directive, and neither must
 * anything it imports.
 *
 * Server Components prefetch queries using these keys (see
 * shared/services/prefetch.ts). A Server Component that imports a value from a
 * `"use client"` module gets a client-reference stub, not the value: the import
 * resolves to `undefined` at runtime with no error. That produced a dehydrated
 * cache entry keyed `undefined`, which the client hook could never match — so the
 * prefetch ran, cost a query, and was thrown away in silence. Keys therefore live
 * here, in a server-safe module, not next to the hooks that consume them.
 */
export const queryKeys = {
  dashboard: {
    kpis: (institutionId: string) => ["dashboard", "kpis", institutionId] as const,
    overview: ["dashboard", "overview"] as const,
  },
  students: {
    all: ["students"] as const,
    list: (filters?: Filters) => ["students", "list", filters ?? {}] as const,
    detail: (id: string | number) => ["students", "detail", id] as const,
  },
  teachers: {
    all: ["teachers"] as const,
    list: (filters?: Filters) => ["teachers", "list", filters ?? {}] as const,
    detail: (id: string | number) => ["teachers", "detail", id] as const,
  },
  attendance: {
    section: (classSectionId: string, date: string) =>
      ["attendance", "section", classSectionId, date] as const,
  },
  exams: {
    all: ["exams"] as const,
    results: (examId: string | number) => ["exams", "results", examId] as const,
  },
  fees: {
    invoices: (filters?: Filters) => ["fees", "invoices", filters ?? {}] as const,
  },
  auditLog: {
    list: (filters?: Filters) => ["auditLog", "list", filters ?? {}] as const,
  },
} as const;
