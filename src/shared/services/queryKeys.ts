/**
 * Central TanStack Query key factory — the single source of truth for every
 * cache key in the app.
 *
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
 *
 * WHY EVERY KEY, NOT JUST THE PREFETCHED ONES (audit A-M8). This factory used to
 * hold 9 entries while 89 keys were written inline at the hooks, so the "single
 * source of truth" was not one, and the prefetch contract ("the key must be
 * byte-identical to the hook's") rested on discipline plus a runtime assert.
 * `eslint.config.mjs` now forbids an inline `queryKey: [...]` array outside this
 * file, which makes the contract structural.
 *
 * SHAPE. Every namespace exposes `all` — the prefix that invalidates the whole
 * domain — plus one entry per query. Invalidate the narrowest key that covers
 * what a mutation actually changed; `all` is a blunt instrument that refetches
 * every mounted query in the domain (audit A-M7).
 */
type Filters = Record<string, unknown> | undefined;
type Id = string | number | null | undefined;

export const queryKeys = {
  dashboard: {
    all: ["dashboard"] as const,
    kpis: (institutionId: string) => ["dashboard", "kpis", institutionId] as const,
    overview: ["dashboard", "overview"] as const,
    period: (params: Filters) => ["dashboard", "period", params] as const,
    /** Keyed by the institution-local day, so it rolls over at local midnight. */
    today: (day: string, yearId: string) => ["dashboard", "today", day, yearId] as const,
  },

  /** The current academic year — every year-scoped query keys off its id. */
  academicYear: {
    all: ["academic-year"] as const,
    current: ["academic-year", "current"] as const,
    list: ["academic-year", "list"] as const,
  },

  /** The signed-in operator, for the shell's identity slot. */
  admin: {
    me: ["admin", "me"] as const,
  },

  /** Account security: MFA factors, sessions, security events, own profile. */
  security: {
    all: ["security"] as const,
    factors: ["security", "mfa-factors"] as const,
    aal: ["security", "assurance-level"] as const,
    recoveryCount: ["security", "recovery-count"] as const,
    sessions: ["security", "sessions"] as const,
    events: (limit: number) => ["security", "events", limit] as const,
    myProfile: ["security", "my-profile"] as const,
  },

  /** The caller's own institution id — needed by every storage upload path. */
  institution: {
    all: ["institution"] as const,
    currentId: ["institution", "current-id"] as const,
  },

  attendance: {
    all: ["attendance"] as const,
    exams: (yearId: Id) => ["attendance", "exams", yearId] as const,
    sectionAll: ["attendance", "section"] as const,
    section: (classSectionId: Id, attDate: string, context: string, examId?: Id) =>
      ["attendance", "section", classSectionId, attDate, context, examId ?? null] as const,
    summaryAll: ["attendance", "summary"] as const,
    summary: (classSectionId: Id, from: string, to: string) =>
      ["attendance", "summary", classSectionId, from, to] as const,
  },

  cert: {
    all: ["cert"] as const,
    templates: ["cert", "templates"] as const,
    exams: (yearId: Id) => ["cert", "exams", yearId] as const,
    idBatches: ["cert", "id-batches"] as const,
    admitBatches: ["cert", "admit-batches"] as const,
    testimonials: ["cert", "testimonials"] as const,
    transfers: ["cert", "transfers"] as const,
    examSubjects: (examId: Id, classId: Id) => ["cert", "exam-subjects", examId, classId] as const,
    setting: (key: string, scope: string) => ["cert", "setting", key, scope] as const,
  },

  /** Printed-artefact chrome: letterhead, signatures, signed photo URLs. */
  documents: {
    all: ["documents"] as const,
    letterhead: ["documents", "letterhead"] as const,
    signatures: ["documents", "signatures"] as const,
    photos: (fileIds: readonly string[]) => ["documents", "photos", fileIds] as const,
    /** Keyed by the whole SPEC, not the batch id: the ID-card screen previews
     *  an unsaved draft whose id is the constant "draft", so keying on the id
     *  would serve the first class the operator picked for every later one. */
    batchStudents: (spec: Record<string, unknown> | null) => ["documents", "batch-students", spec] as const,
    seatNumbers: (batchId: Id) => ["documents", "seat-numbers", batchId] as const,
    certificate: (kind: string, id: Id) => ["documents", "certificate", kind, id] as const,
    receipt: (paymentId: Id) => ["documents", "receipt", paymentId] as const,
    marksheet: (examId: Id, studentId: Id) => ["documents", "marksheet", examId, studentId] as const,
    tabulation: (examId: Id, sectionId: Id) => ["documents", "tabulation", examId, sectionId] as const,
  },

  core: {
    all: ["core"] as const,
    institution: ["core", "institution"] as const,
    boards: ["core", "boards"] as const,
    teacherOptions: ["core", "teacherOptions"] as const,
    classes: ["core", "classes"] as const,
    subjects: ["core", "subjects"] as const,
    groups: ["core", "groups"] as const,
    schemes: ["core", "schemes"] as const,
    signatures: ["core", "signatures"] as const,
    classSectionsAll: ["core", "classSections"] as const,
    classSections: (classId: Id, yearId: Id) => ["core", "classSections", classId, yearId] as const,
    usersAll: ["core", "users"] as const,
    users: (params: Filters) => ["core", "users", "list", params] as const,
    myPermissions: ["core", "my-permissions"] as const,
    entitySearch: (term: string) => ["core", "entity-search", term] as const,
    permissionMatrix: ["core", "permission-matrix"] as const,
    setting: (key: string, scope: string) => ["core", "setting", key, scope] as const,
    calendarAll: ["core", "calendar"] as const,
    calendar: (from: string, to: string) => ["core", "calendar", from, to] as const,
    calendarDay: (date: string) => ["core", "calendar", "day", date] as const,
    termsAll: ["core", "terms"] as const,
    terms: (yearId: Id) => ["core", "terms", yearId] as const,
  },

  exam: {
    all: ["exam"] as const,
    listAll: ["exam", "list"] as const,
    list: (yearId: Id) => ["exam", "list", yearId] as const,
    gradeSchemes: ["exam", "grade-schemes"] as const,
    sectionClass: (sectionId: Id) => ["exam", "section-class", sectionId] as const,
    marksAll: ["exam", "marks"] as const,
    marks: (examId: Id, classId: Id, subjectId: Id) =>
      ["exam", "marks", examId, classId, subjectId] as const,
    resultsAll: ["exam", "results"] as const,
    /** Prefix for every section's results of one exam — use to invalidate. */
    resultsForExam: (examId: Id) => ["exam", "results", examId] as const,
    results: (examId: Id, sectionId?: Id) =>
      ["exam", "results", examId, sectionId ?? null] as const,
    subjectMarks: (subjectId: Id) => ["exam", "subject-marks", subjectId] as const,
    config: (kind: string) => ["exam", "config", kind] as const,
    resultStatus: (examId: Id) => ["exam", "result-status", examId] as const,
  },

  fee: {
    all: ["fee"] as const,
    heads: ["fee", "heads"] as const,
    accounts: ["fee", "accounts"] as const,
    mappings: ["fee", "mappings"] as const,
    invoicesAll: ["fee", "invoices"] as const,
    invoices: (studentId: Id, yearId: Id) => ["fee", "invoices", studentId, yearId] as const,
    profile: (studentId: Id) => ["fee", "profile", studentId] as const,
    unpaidSectionAll: ["fee", "unpaid-section"] as const,
    unpaidSection: (sectionId: Id) => ["fee", "unpaid-section", sectionId] as const,
    unpaidInstitute: ["fee", "unpaid-institute"] as const,
    appliedAll: ["fee", "applied"] as const,
    applied: (params: Filters, yearId: Id) => ["fee", "applied", params, yearId] as const,
    digitalAll: ["fee", "digital"] as const,
    digital: (page: number) => ["fee", "digital", "list", page] as const,
    digitalStats: ["fee", "digital", "stats"] as const,
    incomeAll: ["fee", "income"] as const,
    income: (from: string, to: string) => ["fee", "income", from, to] as const,
    dayBookAll: ["fee", "day-book"] as const,
    dayBook: (date: string, collector: Id) => ["fee", "day-book", date, collector ?? null] as const,
    studentSearch: (term: string) => ["fee", "student-search", term] as const,
  },

  sms: {
    all: ["sms"] as const,
    account: ["sms", "account"] as const,
    packages: ["sms", "packages"] as const,
    templates: ["sms", "templates"] as const,
    campaignsAll: ["sms", "campaigns"] as const,
    campaigns: (page: number) => ["sms", "campaigns", page] as const,
    campaignTotals: ["sms", "campaign-totals"] as const,
    recipients: (audience: string, sectionId: string) =>
      ["sms", "recipients", audience, sectionId] as const,
    noticesAll: ["sms", "notices"] as const,
    notices: (params: Filters) => ["sms", "notices", params] as const,
  },

  students: {
    all: ["students"] as const,
    list: (filters?: Filters) => ["students", "list", filters ?? {}] as const,
    detail: (id: Id) => ["students", "detail", id] as const,
    bySection: (classSectionId: Id) => ["students", "by-section", classSectionId] as const,
    report: (yearId?: string | null) => ["students", "report", yearId ?? "current"] as const,
  },

  /**
   * The Reports module (analysis II · Part C). Keyed by the FILTERS, not just
   * by the year: two filter sets are two different reports and must not share
   * a cache entry — R-5's whole point is that the report is now addressable.
   */
  reports: {
    all: ["reports"] as const,
    enrolment: (yearId: Id, filters: Filters) => ["reports", "enrolment", yearId, filters ?? {}] as const,
    exams: (yearId: Id) => ["reports", "exams", yearId] as const,
    academic: (examId: Id) => ["reports", "academic", examId] as const,
    atRisk: (yearId: Id) => ["reports", "at-risk", yearId] as const,
    shifts: ["reports", "shifts"] as const,
  },

  teachers: {
    all: ["teachers"] as const,
    list: (filters?: Filters) => ["teachers", "list", filters ?? {}] as const,
    detail: (id: Id) => ["teachers", "detail", id] as const,
    options: ["teachers", "options"] as const,
  },

  migration: {
    all: ["migration-batches"] as const,
    exams: (yearId: Id) => ["migration-batches", "exams", yearId] as const,
    candidates: (classSectionId: Id, examId: Id) =>
      ["migration-batches", "candidates", classSectionId, examId] as const,
    batches: (yearId: Id) => ["migration-batches", "list", yearId] as const,
    batchStudents: (batchId: Id) => ["migration-batches", "students", batchId] as const,
  },

  roster: {
    all: ["roster"] as const,
    sectionStudents: (classSectionId: Id) =>
      ["roster", "section-students", classSectionId] as const,
  },

  /** Reference data. Long `staleTime`; effectively never invalidated. */
  lookup: {
    all: ["lookup"] as const,
    divisions: ["lookup", "divisions"] as const,
    districts: (divisionId: Id) => ["lookup", "districts", divisionId] as const,
    upazilas: (districtId: Id) => ["lookup", "upazilas", districtId] as const,
    years: ["lookup", "years"] as const,
    classes: ["lookup", "classes"] as const,
    classSections: (yearId: Id) => ["lookup", "class-sections", yearId] as const,
    studentCategories: ["lookup", "student-categories"] as const,
    designations: ["lookup", "designations"] as const,
    departments: ["lookup", "departments"] as const,
    subjects: ["lookup", "subjects"] as const,
  },

  auditLog: {
    all: ["auditLog"] as const,
    list: (filters?: Filters) => ["auditLog", "list", filters ?? {}] as const,
    actors: ["auditLog", "actors"] as const,
  },
} as const;
