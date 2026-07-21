/**
 * Central TanStack Query key factory. Prevents cache-key collisions across
 * features. Each feature composes on top of its domain namespace here.
 */
type Filters = Record<string, unknown> | undefined;

export const queryKeys = {
  dashboard: {
    kpis: (institutionId: string) => ["dashboard", "kpis", institutionId] as const,
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
