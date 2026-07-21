# EduFusionBD Admin Panel — 100/100 Institutional-Grade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the admin panel from the 2026-07-20 audit score of 70/100 (B−) to institutional-grade by closing the four gap categories that scored lowest: UX & Enterprise Features (46), Responsive (58), Performance & Scalability (61), and finishing Accessibility (68) and Design System (79).

**Architecture:** No architectural change. Every task extends the existing pattern already proven in the codebase (`api.ts` → `useX` hook → TanStack Query → screen component built from `shared/ui` primitives), so each task is additive and independently shippable — this is explicitly not a rewrite.

**Tech Stack:** Next 15.1.3 · React 19 · Tailwind CSS 4 · TanStack Query 5.62 · Supabase JS 2.47 (`@supabase/ssr` 0.5) · next-intl 3.26 · zod 3.24 · lucide-react. Live Supabase project: `dkumhtrrgsuwxucgncix`.

## Global Constraints

- **No test framework exists in this repo today** — `package.json` has no `test` script and no vitest/jest/RTL dependency. This plan does **not** silently bootstrap one. Verification per task is `npx tsc --noEmit` + `npx next lint` + `npx next build`, plus a manual smoke pass — matching how every prior session in this codebase has verified its work. Phase 4 offers adding a minimal Vitest setup as an explicit, separate decision — say so if you want it pulled earlier.
- Every Supabase call goes through `BrowserClient` from `@/shared/services/supabase/client` (`createClient()`), never a raw client.
- Every new screen-level i18n string goes through `useT()` from `@/shared/i18n/useT` — `const { t, n, isBn, tb } = useT(); t(bn, en)` for text, `n(value)` for any digit a user reads.
- Every reusable component is added to `src/shared/ui/index.ts`'s barrel export — that file is the single import surface (`import { Table, Modal, Breadcrumb } from "@/shared/ui"`).
- TanStack Query keys are centralized in `src/shared/services/queryKeys.ts` — add to it, never inline a raw key array in a hook.
- Don't add a dependency for anything the browser or an already-installed package already does (CSV export, debounce, and the command palette below are all hand-rolled for exactly this reason — each is under 40 lines).
- RLS is the real security boundary (confirmed live on every table touched below) — this plan improves the UI's respect for that boundary (pagination, scoped queries), it does not touch policies.

---

## File structure overview

```
src/shared/ui/
  Breadcrumb.tsx        NEW — Phase 2, Task 6
  Pagination.tsx         MODIFY — Phase 1, Task 1 (add onPageChange)
  index.ts                MODIFY — export Breadcrumb

src/shared/lib/
  useDebouncedValue.ts   NEW — Phase 1, Task 3
  exportCsv.ts             NEW — Phase 3, Task 9

src/shared/services/
  queryKeys.ts             MODIFY — add auditLog key factory (Phase 1, Task 1)

src/features/admin/core/screens/audit-log/
  AuditLogScreen.tsx     NEW — Phase 1, Task 1
  logic/api.ts               NEW
  logic/useAuditLog.ts    NEW

src/app/(admin)/admin/core/audit-log/page.tsx   NEW — Phase 1, Task 1

src/features/admin/components/
  AdminShell.tsx           MODIFY — Phase 1, Task 2 (kill/wire decorative controls)
  adminNav.ts                 MODIFY — Phase 1, Task 1 (nav entry) + Task 4 (command palette shortcut hint)

src/features/admin/teacher/screens/list/
  ListScreen.tsx            MODIFY — Phase 1, Task 2 (wire buttons), Task 3 (pagination+debounce), Phase 2 Task 6 (breadcrumb), Phase 3 Task 8 (bulk actions)
  logic/api.ts, logic/useTeachers.ts   MODIFY — Task 3

src/features/admin/sms-notice/logic/hooks.ts     (read-only reuse — useSmsAccount already exists)

src/app/globals.css          MODIFY — Phase 2, Task 5 (type-scale tokens)

src/features/admin/core/components/
  CommandPalette.tsx      NEW — Phase 3, Task 10
```

---

# PHASE 1 — Trust & Scale Floor (Critical)

Four tasks. Ships as one pilot-readiness release. Nothing here is a rewrite — Task 1 is pure addition, Tasks 2–4 are small, surgical edits to files that already exist.

### Task 1: Audit Log screen

The `audit_log` table is fully live already — confirmed directly against the running database, not assumed:
- RLS is **on and forced** (`relrowsecurity=true, relforcerowsecurity=true`), with policy `audit_policy`: `institution_id = current_institution_id() OR is_platform_admin()`, covering `ALL` commands for `authenticated`.
- Six triggers (`trg_audit_mark`, `trg_audit_exam_result`, `trg_audit_fee_invoice`, `trg_audit_student_enrollment`, `trg_audit_migration_batch`, `trg_audit_setting`) already insert a row on every INSERT/UPDATE/DELETE of those six tables.
- Columns: `id, institution_id, entity, entity_id, action, changed_by, at, before(jsonb), after(jsonb)`.
- `changed_by` is a user id — display name comes from `profile.full_name` (confirmed: `profile(id, full_name)` exists).

So this task is 100% frontend — no migration needed.

**Files:**
- Create: `src/features/admin/core/screens/audit-log/logic/api.ts`
- Create: `src/features/admin/core/screens/audit-log/logic/useAuditLog.ts`
- Create: `src/features/admin/core/screens/audit-log/AuditLogScreen.tsx`
- Create: `src/app/(admin)/admin/core/audit-log/page.tsx`
- Modify: `src/features/admin/components/adminNav.ts`
- Modify: `src/shared/services/queryKeys.ts`
- Modify: `src/shared/ui/Pagination.tsx` (add real interactivity — see below)
- Modify: `src/shared/ui/index.ts` (no change needed, `Pagination` already exported)

**Interfaces:**
- Produces: `fetchAuditLog(supabase, {page?, entity?}): Promise<{rows: AuditLogRow[]; total: number}>`, `AUDIT_ENTITIES: readonly string[]`, `useAuditLog(page: number, entity?: string)`.

- [ ] **Step 1: Fix `Pagination` to be a real controlled component**

`Pagination` renders page-number buttons today but none of them have an `onClick` — it's decorative, exactly like the audit flagged. Every screen that adopts pagination in this plan (this task, Task 3, and the Phase 2 rollout) needs it wired once, here, rather than each screen reinventing page-click handling.

Modify `src/shared/ui/Pagination.tsx`:

```tsx
"use client";

import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { cn } from "@/shared/lib/cn";
import type { ButtonHTMLAttributes } from "react";

export function Pagination({
  label,
  pages = 4,
  current = 1,
  perPage,
  onPageChange,
}: {
  label: string;
  pages?: number;
  current?: number;
  /** Per-page count. Accepts Bengali or ASCII digits; defaults to 10. */
  perPage?: string | number;
  /** Called with the target page number. Omit to render a static, non-interactive footer. */
  onPageChange?: (page: number) => void;
}) {
  const { t, n } = useT();
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border-default px-5 py-3.5">
      <span className="flex-1 text-[13px] text-text-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <PageBtn
          aria-label={t("আগে", "Previous")}
          disabled={current <= 1}
          onClick={() => onPageChange?.(Math.max(1, current - 1))}
        >
          <ChevronLeft size={15} />
        </PageBtn>
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <PageBtn key={p} active={p === current} onClick={() => onPageChange?.(p)}>
            {n(p)}
          </PageBtn>
        ))}
        <PageBtn
          aria-label={t("পরে", "Next")}
          disabled={current >= pages}
          onClick={() => onPageChange?.(Math.min(pages, current + 1))}
        >
          <ChevronRight size={15} />
        </PageBtn>
        <button className="ml-1 flex h-8 items-center gap-1 rounded-lg border border-border-strong bg-surface px-2.5 text-[13px] font-medium text-text-secondary hover:bg-sunken">
          {n(perPage ?? 10)}
          <ChevronDown size={13} className="text-text-muted" />
        </button>
      </div>
    </div>
  );
}

function PageBtn({
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-8 place-items-center rounded-lg text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-primary text-text-on-primary"
          : "border border-border-strong bg-surface text-text-secondary hover:bg-sunken",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

`onPageChange` is optional, so every existing (currently zero, per grep — nothing in `features/admin` uses `<Pagination` yet) or future static usage keeps compiling unchanged.

- [ ] **Step 2: Add the query-key factory entry**

Modify `src/shared/services/queryKeys.ts`, inside the `queryKeys` object, after `fees`:

```ts
  auditLog: {
    list: (filters?: Filters) => ["auditLog", "list", filters ?? {}] as const,
  },
```

- [ ] **Step 3: Write the data-access layer**

Create `src/features/admin/core/screens/audit-log/logic/api.ts`:

```ts
// Supabase data access for the Audit Log screen. RLS-scoped via audit_policy
// (institution_id match or platform admin) — enforced on the audit_log table
// itself, not re-implemented here.
import type { BrowserClient } from "@/shared/services/supabase/types";

export type AuditLogRow = {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  at: string;
  changedByName: string | null;
  before: unknown;
  after: unknown;
};

export const AUDIT_ENTITIES = [
  "mark",
  "exam_result",
  "fee_invoice",
  "student_enrollment",
  "migration_batch",
  "setting",
] as const;

const PAGE_SIZE = 25;

export async function fetchAuditLog(
  supabase: BrowserClient,
  { page = 1, entity }: { page?: number; entity?: string },
): Promise<{ rows: AuditLogRow[]; total: number }> {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("audit_log")
    .select("id, entity, entity_id, action, at, before, after, changed_by:profile(full_name)", {
      count: "exact",
    })
    .order("at", { ascending: false })
    .range(from, to);

  if (entity) query = query.eq("entity", entity);

  const { data, error, count } = await query;
  if (error) throw error;

  type Raw = {
    id: string;
    entity: string;
    entity_id: string;
    action: string;
    at: string;
    before: unknown;
    after: unknown;
    changed_by: { full_name: string | null } | null;
  };
  const rows = ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    entity: r.entity,
    entityId: r.entity_id,
    action: r.action,
    at: r.at,
    changedByName: r.changed_by?.full_name ?? null,
    before: r.before,
    after: r.after,
  }));

  return { rows, total: count ?? 0 };
}
```

- [ ] **Step 4: Write the hook**

Create `src/features/admin/core/screens/audit-log/logic/useAuditLog.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { fetchAuditLog } from "./api";

export function useAuditLog(page: number, entity?: string) {
  return useQuery({
    queryKey: queryKeys.auditLog.list({ page, entity }),
    queryFn: () => fetchAuditLog(createClient(), { page, entity }),
  });
}
```

- [ ] **Step 5: Write the screen**

Create `src/features/admin/core/screens/audit-log/AuditLogScreen.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  TableEmpty,
  Badge,
  ErrorState,
  Pagination,
  Modal,
  Breadcrumb,
} from "@/shared/ui";
import { useAuditLog } from "./logic/useAuditLog";
import { AUDIT_ENTITIES, type AuditLogRow } from "./logic/api";

const ENTITY_LABEL: Record<string, { bn: string; en: string }> = {
  mark: { bn: "মার্ক", en: "Marks" },
  exam_result: { bn: "ফলাফল", en: "Exam Result" },
  fee_invoice: { bn: "ফি চালান", en: "Fee Invoice" },
  student_enrollment: { bn: "ভর্তি", en: "Enrollment" },
  migration_batch: { bn: "মাইগ্রেশন", en: "Migration" },
  setting: { bn: "সেটিংস", en: "Setting" },
};

const ACTION_TONE: Record<string, "success" | "warning" | "danger"> = {
  INSERT: "success",
  UPDATE: "warning",
  DELETE: "danger",
};

const PER_PAGE = 25;

export function AuditLogScreen() {
  const { t } = useT();
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [selected, setSelected] = useState<AuditLogRow | null>(null);
  const { data, isLoading, isError, refetch } = useAuditLog(page, entity || undefined);

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="flex flex-col gap-7">
      <div>
        <Breadcrumb
          items={[
            { label: t("কোর সেটিংস", "Core Settings"), href: "/admin/core/basic-config" },
            { label: t("পরিবর্তনের ইতিহাস", "Audit Log") },
          ]}
        />
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">
          {t("পরিবর্তনের ইতিহাস", "Audit Log")}
        </h1>
        <p className="mt-1 text-meta text-text-muted">
          {t("কে, কখন, কী পরিবর্তন করেছে তার সম্পূর্ণ তালিকা", "Every recorded change — who, when, and what")}
        </p>
      </div>

      <select
        value={entity}
        onChange={(e) => {
          setEntity(e.target.value);
          setPage(1);
        }}
        aria-label={t("বিভাগ ফিল্টার", "Filter by entity")}
        className="w-fit rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-meta font-medium text-text-secondary"
      >
        <option value="">{t("সব বিভাগ", "All entities")}</option>
        {AUDIT_ENTITIES.map((e) => (
          <option key={e} value={e}>
            {t(ENTITY_LABEL[e].bn, ENTITY_LABEL[e].en)}
          </option>
        ))}
      </select>

      {isError ? (
        <ErrorState
          title={t("তথ্য লোড করা যায়নি", "Couldn't load the audit log")}
          action={
            <button
              onClick={() => refetch()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-text-on-primary"
            >
              {t("পুনরায় চেষ্টা", "Retry")}
            </button>
          }
        />
      ) : (
        <>
          <Table minWidth={760}>
            <THead>
              <TR>
                <TH>{t("সময়", "When")}</TH>
                <TH>{t("বিভাগ", "Entity")}</TH>
                <TH>{t("অ্যাকশন", "Action")}</TH>
                <TH>{t("পরিবর্তনকারী", "Changed by")}</TH>
                <TH className="w-14">
                  <span className="sr-only">{t("বিস্তারিত", "Details")}</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TR key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TD key={j}>
                        <span className="block h-5 animate-pulse rounded bg-sunken" />
                      </TD>
                    ))}
                  </TR>
                ))
              ) : (data?.rows.length ?? 0) === 0 ? (
                <TableEmpty colSpan={5} title={t("কোনো রেকর্ড পাওয়া যায়নি", "No audit records found")} />
              ) : (
                data!.rows.map((r) => (
                  <TR key={r.id}>
                    <TD className="text-meta text-text-secondary">{new Date(r.at).toLocaleString()}</TD>
                    <TD>{t(ENTITY_LABEL[r.entity]?.bn ?? r.entity, ENTITY_LABEL[r.entity]?.en ?? r.entity)}</TD>
                    <TD>
                      <Badge tone={ACTION_TONE[r.action] ?? "info"}>{r.action}</Badge>
                    </TD>
                    <TD className="text-meta text-text-secondary">{r.changedByName ?? t("সিস্টেম", "System")}</TD>
                    <TD className="text-center">
                      <button
                        onClick={() => setSelected(r)}
                        aria-label={t("বিস্তারিত দেখুন", "View details")}
                        className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-sunken"
                      >
                        <Eye size={16} />
                      </button>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>

          {total > 0 ? (
            <Pagination
              label={t(
                `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} দেখানো হচ্ছে · মোট ${total} জন`,
                `Showing ${(page - 1) * PER_PAGE + 1}-${Math.min(page * PER_PAGE, total)} of ${total}`,
              )}
              pages={pages}
              current={page}
              onPageChange={setPage}
            />
          ) : null}
        </>
      )}

      <Modal open={selected !== null} onClose={() => setSelected(null)} title={t("পরিবর্তনের বিস্তারিত", "Change details")}>
        {selected ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[12px] font-semibold uppercase text-text-muted">{t("আগে", "Before")}</p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-sunken p-3 text-[12px]">
                {JSON.stringify(selected.before, null, 2) ?? "—"}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-[12px] font-semibold uppercase text-text-muted">{t("পরে", "After")}</p>
              <pre className="max-h-64 overflow-auto rounded-lg bg-sunken p-3 text-[12px]">
                {JSON.stringify(selected.after, null, 2) ?? "—"}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
```

Note: this uses `text-h4`/`text-meta` tokens and `<Breadcrumb>` from Phase 2 (Tasks 5 and 6). Since this is a **new** screen, it's cheaper to build it against the target design system directly than to build it against arbitrary pixel values and migrate it later — do Phase 2 Tasks 5 and 6 first, or inline `text-[22px]`/`text-[13px]` and the old hand-rolled breadcrumb div here temporarily and let the Phase 2 migration catch it. Either order works; the code above assumes Tasks 5–6 landed first.

- [ ] **Step 6: Wire the route**

Create `src/app/(admin)/admin/core/audit-log/page.tsx`:

```tsx
import { AuditLogScreen } from "@/features/admin/core/screens/audit-log/AuditLogScreen";

export default function Page() {
  return <AuditLogScreen />;
}
```

- [ ] **Step 7: Add the nav entry**

Modify `src/features/admin/components/adminNav.ts` — inside the `core` item's `sub`, in the "ইউজার সেটিংস / User Settings" group (currently only `user-list`):

```ts
          {
            label: { bn: "ইউজার সেটিংস", en: "User Settings" },
            items: [
              { href: "/admin/core/user-list", bn: "ইউজার তালিকা", en: "User List" },
              { href: "/admin/core/audit-log", bn: "পরিবর্তনের ইতিহাস", en: "Audit Log" },
            ],
          },
```

- [ ] **Step 8: Verify and commit**

```bash
npx tsc --noEmit
npx next lint
npx next build
```
Expected: all three clean/succeed, `/admin/core/audit-log` listed in the build route output.

Manual smoke: `npm run dev`, log in as admin, go to Core Settings → Audit Log. If the table is empty (no mutations yet on `mark`/`exam_result`/`fee_invoice`/`student_enrollment`/`migration_batch`/`setting` since the triggers were added), confirm the empty state renders correctly, then perform one real edit (e.g. edit a fee invoice) and confirm a new row appears after refetch.

```bash
git add src/features/admin/core/screens/audit-log src/app/"(admin)"/admin/core/audit-log src/shared/ui/Pagination.tsx src/shared/services/queryKeys.ts src/features/admin/components/adminNav.ts
git commit -m "feat(admin): add Audit Log screen, wire Pagination to be interactive"
```

---

### Task 2: Kill or wire every decorative control

**Files:**
- Modify: `src/features/admin/components/AdminShell.tsx:248` (hardcoded SMS balance)
- Modify: `src/features/admin/components/AdminShell.tsx:251-265` (dead Search + Bell buttons)
- Modify: `src/features/admin/teacher/screens/list/ListScreen.tsx:45` (dead "New Teacher" button)
- Modify: `src/features/admin/teacher/screens/list/ListScreen.tsx:63-66` (dead "Department: All" filter)
- Modify: `src/features/admin/teacher/screens/list/logic/api.ts` (add department to the select)

**Interfaces:**
- Consumes: `useSmsAccount()` from `@/features/admin/sms-notice/logic/hooks` — already exists, returns `{ data, isLoading, ... }` where `data: { balance: number; per_sms_rate: number; ... } | null`.

- [ ] **Step 1: Wire the SMS balance to the real query**

`useSmsAccount` already exists (`src/features/admin/sms-notice/logic/hooks.ts:9`) and already backs the real Balance & Purchase screen — it was simply never called from the shell.

Modify `src/features/admin/components/AdminShell.tsx`, add the import near the other hooks/utilities:

```ts
import { useSmsAccount } from "@/features/admin/sms-notice/logic/hooks";
```

Inside `AdminShell`, alongside the existing `useT()` call:

```ts
  const { data: smsAccount } = useSmsAccount();
```

Replace the hardcoded pill (currently `<span>{num("8,250")} SMS</span>`):

```tsx
          <div className="hidden items-center gap-1.5 rounded-full bg-success-bg px-3 py-1.5 text-meta font-semibold text-success-fg sm:flex">
            <MessageSquareText size={15} />
            <span>{smsAccount ? `${num(smsAccount.balance.toLocaleString())} SMS` : "—"}</span>
          </div>
```

- [ ] **Step 2: Remove the two dead topbar buttons**

Delete the Search button and the Notification bell button (`AdminShell.tsx:251-265`) entirely — both currently look interactive (proper `aria-label`, hover state, and for the bell an unread dot that renders unconditionally) but have no `onClick`. Shipping nothing there is more honest than shipping a button that lies about what it does.

```tsx
-          <button
-            type="button"
-            aria-label={tx("অনুসন্ধান", "Search")}
-            className="grid size-9 place-items-center rounded-lg border border-border-strong text-text-secondary hover:bg-sunken"
-          >
-            <Search size={18} />
-          </button>
-          <button
-            type="button"
-            aria-label={tx("বিজ্ঞপ্তি", "Notifications")}
-            className="relative grid size-9 place-items-center rounded-lg border border-border-strong text-text-secondary hover:bg-sunken"
-          >
-            <Bell size={18} />
-            <span className="absolute right-2 top-2 size-2 rounded-full bg-danger-fg" />
-          </button>
```

Remove the now-unused `Search` and `Bell` imports from the `lucide-react` import line. (Phase 3 Task 10 replaces the Search slot with a real, working command palette — a notifications feature isn't in scope anywhere in the schema today, so the bell stays removed until there's a real `notification` table to back it.)

- [ ] **Step 3: Wire "New Teacher" to the route that already exists**

The registration screen is already live at `/admin/teacher/registration` (see `adminNav.ts`). Modify `src/features/admin/teacher/screens/list/ListScreen.tsx`:

```tsx
-        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary hover:bg-primary-hover">
-          <UserPlus size={16} /> {t("নতুন শিক্ষক", "New Teacher")}
-        </button>
+        <Link
+          href="/admin/teacher/registration"
+          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-text-on-primary hover:bg-primary-hover"
+        >
+          <UserPlus size={16} /> {t("নতুন শিক্ষক", "New Teacher")}
+        </Link>
```

Add `import Link from "next/link";` at the top of the file.

- [ ] **Step 4: Wire "Department: All" to a real, already-modeled field**

The `teacher` table has `department_id`, and a `department` table (`id, institution_id, name`) already exists — confirmed against the live schema. This filter can be genuinely real, not removed.

Modify `src/features/admin/teacher/screens/list/logic/api.ts` — add `department` to the select and the returned row shape:

```ts
export type TeacherRow = {
  id: string;
  name_bn: string;
  name_en: string;
  email: string | null;
  status: string;
  designation: string | null;
  subject_bn: string | null;
  subject_en: string | null;
  department: string | null;
  classTeacher: boolean;
};

export async function fetchTeachers(supabase: BrowserClient): Promise<TeacherRow[]> {
  const [teachersRes, csRes] = await Promise.all([
    supabase
      .from("teacher")
      .select(
        "id, name_bn, name_en, email, status, designation:designation_id(name), subject:main_subject_id(name_bn, name_en), department:department_id(name)",
      )
      .is("deleted_at", null)
      .order("employee_code", { ascending: true }),
    supabase.from("class_section").select("class_teacher_id").not("class_teacher_id", "is", null),
  ]);
  if (teachersRes.error) throw teachersRes.error;
  if (csRes.error) throw csRes.error;

  const csRows = (csRes.data ?? []) as unknown as { class_teacher_id: string | null }[];
  const classTeacherIds = new Set(
    csRows.map((r) => r.class_teacher_id).filter((v): v is string => Boolean(v)),
  );

  type Raw = {
    id: string;
    name_bn: string;
    name_en: string;
    email: string | null;
    status: string;
    designation: { name: string | null } | null;
    subject: { name_bn: string | null; name_en: string | null } | null;
    department: { name: string | null } | null;
  };
  const rows = (teachersRes.data ?? []) as unknown as Raw[];

  return rows.map((r) => ({
    id: r.id,
    name_bn: r.name_bn,
    name_en: r.name_en,
    email: r.email,
    status: r.status,
    designation: r.designation?.name ?? null,
    subject_bn: r.subject?.name_bn ?? null,
    subject_en: r.subject?.name_en ?? null,
    department: r.department?.name ?? null,
    classTeacher: classTeacherIds.has(r.id),
  }));
}
```

Modify `ListScreen.tsx` — replace the dead filter button with a real `<select>` populated from the data actually returned, filtering client-side alongside the existing search term (this screen still fetches the full roster at this point in the plan; Task 3 below adds real range pagination on top of this same file):

```tsx
  const [dept, setDept] = useState("");
  const departments = Array.from(new Set((data ?? []).map((r) => r.department).filter((d): d is string => Boolean(d))));

  const rows = (data ?? []).filter(
    (r) =>
      (!term ||
        r.name_bn.toLowerCase().includes(term) ||
        r.name_en.toLowerCase().includes(term) ||
        (r.email ?? "").toLowerCase().includes(term)) &&
      (!dept || r.department === dept),
  );
```

```tsx
-        <button className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-[13px] font-medium text-text-secondary hover:bg-sunken">
-          {t("বিভাগ: সব", "Department: All")}
-          <ChevronDown size={14} className="text-text-muted" />
-        </button>
+        <select
+          value={dept}
+          onChange={(e) => setDept(e.target.value)}
+          aria-label={t("বিভাগ ফিল্টার", "Filter by department")}
+          className="rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-meta font-medium text-text-secondary"
+        >
+          <option value="">{t("বিভাগ: সব", "Department: All")}</option>
+          {departments.map((d) => (
+            <option key={d} value={d}>{d}</option>
+          ))}
+        </select>
```

Remove the now-unused `ChevronDown` import if nothing else in the file uses it.

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit
npx next lint
npx next build
```

Manual smoke: load `/admin/teacher/list`, confirm the SMS pill in the topbar shows the real balance from the Balance & Purchase screen (cross-check the two match), confirm "New Teacher" navigates to the registration screen, confirm the Department filter actually narrows the visible rows.

```bash
git add src/features/admin/components/AdminShell.tsx src/features/admin/teacher/screens/list
git commit -m "fix(admin): remove dead topbar controls, wire SMS balance + New Teacher + Department filter to real data"
```

---

### Task 3: Server-scoped pagination + debounced search on the Teacher list

This is the canonical pattern — the highest-traffic list screen in the app, and the one the audit specifically cited for fetching every row and filtering in the browser. Every screen in the Phase 2 rollout checklist (Task 7) copies this task's shape exactly.

**Files:**
- Modify: `src/features/admin/teacher/screens/list/logic/api.ts`
- Modify: `src/features/admin/teacher/screens/list/logic/useTeachers.ts`
- Modify: `src/features/admin/teacher/screens/list/ListScreen.tsx`
- Create: `src/shared/lib/useDebouncedValue.ts`
- Modify: `src/shared/services/queryKeys.ts`

**Interfaces:**
- Produces: `useDebouncedValue<T>(value: T, delayMs?: number): T` — reused by every screen in Task 7.
- Produces: `fetchTeachers(supabase, {page, perPage, search, department}): Promise<{rows: TeacherRow[]; total: number}>` (return shape changes from Task 2's `TeacherRow[]` to a paged envelope — this is the same file two tasks in a row; do Task 2 first, then this).

- [ ] **Step 1: Add the debounce hook**

Create `src/shared/lib/useDebouncedValue.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

/** Delays reflecting `value` until it stops changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
```

- [ ] **Step 2: Move pagination and search server-side in `api.ts`**

Modify `src/features/admin/teacher/screens/list/logic/api.ts` — change `fetchTeachers` to accept and apply `page`/`perPage`/`search`/`department`, and return a paged envelope:

```ts
const PAGE_SIZE_DEFAULT = 20;

export async function fetchTeachers(
  supabase: BrowserClient,
  { page = 1, perPage = PAGE_SIZE_DEFAULT, search = "", department = "" }:
    { page?: number; perPage?: number; search?: string; department?: string } = {},
): Promise<{ rows: TeacherRow[]; total: number }> {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const [teachersRes, csRes] = await Promise.all([
    (() => {
      let q = supabase
        .from("teacher")
        .select(
          "id, name_bn, name_en, email, status, designation:designation_id(name), subject:main_subject_id(name_bn, name_en), department:department_id(name)",
          { count: "exact" },
        )
        .is("deleted_at", null);
      if (search.trim()) {
        const term = search.trim();
        q = q.or(`name_bn.ilike.%${term}%,name_en.ilike.%${term}%,email.ilike.%${term}%`);
      }
      if (department) q = q.eq("department.name", department);
      return q.order("employee_code", { ascending: true }).range(from, to);
    })(),
    supabase.from("class_section").select("class_teacher_id").not("class_teacher_id", "is", null),
  ]);
  if (teachersRes.error) throw teachersRes.error;
  if (csRes.error) throw csRes.error;

  const csRows = (csRes.data ?? []) as unknown as { class_teacher_id: string | null }[];
  const classTeacherIds = new Set(
    csRows.map((r) => r.class_teacher_id).filter((v): v is string => Boolean(v)),
  );

  type Raw = {
    id: string; name_bn: string; name_en: string; email: string | null; status: string;
    designation: { name: string | null } | null;
    subject: { name_bn: string | null; name_en: string | null } | null;
    department: { name: string | null } | null;
  };
  const rows = ((teachersRes.data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    name_bn: r.name_bn,
    name_en: r.name_en,
    email: r.email,
    status: r.status,
    designation: r.designation?.name ?? null,
    subject_bn: r.subject?.name_bn ?? null,
    subject_en: r.subject?.name_en ?? null,
    department: r.department?.name ?? null,
    classTeacher: classTeacherIds.has(r.id),
  }));

  return { rows, total: teachersRes.count ?? 0 };
}
```

Note: PostgREST's `.eq("department.name", department)` filters on the embedded relation directly — this works because `department` is a to-one embed via `department_id`. If verification (Step 5) shows this particular filter form rejected by PostgREST in this Supabase version, the fallback is a two-step query (look up `department.id` by `name` first, then `.eq("department_id", id)`) — try the one-line form first, it's supported by the Supabase client version pinned in this repo (2.47).

- [ ] **Step 3: Update the hook and query key**

Modify `src/shared/services/queryKeys.ts`, replace the `teachers.list` line:

```ts
    list: (filters?: Filters) => ["teachers", "list", filters ?? {}] as const,
```
(unchanged signature — filters already accepts an arbitrary object, so `{page, search, department}` fits without editing this file further beyond what's already there.)

Modify `src/features/admin/teacher/screens/list/logic/useTeachers.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/services/supabase/client";
import { queryKeys } from "@/shared/services/queryKeys";
import { fetchTeachers } from "./api";

export function useTeachers(page: number, search: string, department: string) {
  return useQuery({
    queryKey: queryKeys.teachers.list({ page, search, department }),
    queryFn: () => fetchTeachers(createClient(), { page, search, department }),
    placeholderData: (prev) => prev,
  });
}
```

`placeholderData: (prev) => prev` keeps the previous page's rows on screen while the next page loads, instead of flashing the skeleton on every click — a one-line addition, not a new abstraction.

- [ ] **Step 4: Update the screen to drive server-side state**

Modify `src/features/admin/teacher/screens/list/ListScreen.tsx` — replace the local `q`/client-filter logic with debounced, server-driven state:

```tsx
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQ = useDebouncedValue(q, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, dept]);

  const { data, isLoading, isError, refetch } = useTeachers(page, debouncedQ, dept);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const perPage = 20;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const departments = Array.from(new Set(rows.map((r) => r.department).filter((d): d is string => Boolean(d))));
```

Add `import { useEffect } from "react";` and `import { useDebouncedValue } from "@/shared/lib/useDebouncedValue";`.

Remove the old client-side `term`/`rows = (data ?? []).filter(...)` block from Task 2 — it's now redundant, filtering happens server-side in `fetchTeachers`.

Add the `<Pagination>` footer after the `</Table>` closing tag (same shape as Task 1's Audit Log screen):

```tsx
      {total > 0 ? (
        <Pagination
          label={t(
            `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} দেখানো হচ্ছে · মোট ${total} জন`,
            `Showing ${(page - 1) * perPage + 1}-${Math.min(page * perPage, total)} of ${total}`,
          )}
          pages={pages}
          current={page}
          onPageChange={setPage}
        />
      ) : null}
```

Add `Pagination` to the existing `@/shared/ui` import list.

One caveat worth knowing before you run this: the department dropdown's options are now derived only from the **current page's** rows (`departments` above), not the full roster, since the roster is no longer fetched in full. If that reads oddly in practice (options appearing/disappearing as you paginate), the fix is a tiny second query — `supabase.from("department").select("name").is("deleted_at", null)` — to populate the dropdown independently of the current page. Try the simple version first; add the second query only if it's actually confusing in the smoke test.

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit
npx next lint
npx next build
```

Manual smoke: load `/admin/teacher/list`, confirm rows still render, type a search term and confirm the network tab shows a debounced request (not one per keystroke), change the department filter, click through pagination if there are more than 20 teachers in the pilot data (if there are fewer than 20, add a couple of test rows or verify the "next" button is correctly disabled instead).

```bash
git add src/features/admin/teacher/screens/list src/shared/lib/useDebouncedValue.ts
git commit -m "perf(admin): move Teacher list search/filter/pagination server-side"
```

---

### Task 4: Confirm the audit trail actually shows up end-to-end

Small verification-only task, but it's the one that proves Tasks 1–3 actually deliver what Phase 1 promises — don't skip it.

**Files:** none modified — this is a manual QA task using what Tasks 1–3 built.

- [ ] **Step 1:** Log in as admin, go to a screen that writes to one of the six audited tables (e.g. edit a fee invoice's status, or update a mark). Confirm the write succeeds as it did before this plan.
- [ ] **Step 2:** Go to Core Settings → Audit Log. Confirm the new row appears (may require a manual refetch/navigation — TanStack Query doesn't auto-invalidate `auditLog` on writes elsewhere yet, that's expected; live real-time invalidation is a Phase 3+ nicety, not required here).
- [ ] **Step 3:** Click "View details" on that row, confirm the Before/After JSON reflects the actual field that changed.
- [ ] **Step 4:** Filter by that entity type in the dropdown, confirm the row still appears; filter by a different entity type, confirm it disappears.
- [ ] **Step 5:** Document the result (pass/fail + screenshot) wherever this pilot's QA notes live, then mark Phase 1 done.

---

# PHASE 2 — Design System Completion (High)

### Task 5: Publish a named type scale and migrate to it

The audit found 250+ arbitrary `text-[Npx]` instances against ~150 canonical Tailwind sizes, with no `--text-*` tokens defined anywhere. The actual pixel values in use cluster tightly: 11, 12, 13, 15, 17, 22, 26, 29, 40px. 12px is already Tailwind's built-in `text-xs` (0.75rem) — no new token needed there, just a migration. The rest need names.

**One judgment call this task surfaces rather than hides:** 26px and 29px are used in similar contexts (page-level headings) and are very likely unintentional drift between screens built in different sessions rather than two deliberately distinct sizes. This plan consolidates them into one `text-h3` (26px, the more common of the two) — before running the migration, spot-check a 26px screen against a 29px screen side by side; if there's a real reason they differ (e.g. one is genuinely a bigger "hero" number), split them back into two tokens instead. Don't skip this check to save time — silently merging two intentionally-different sizes is a worse outcome than the sprawl this task is fixing.

**Files:**
- Modify: `src/app/globals.css`
- Modify: every `.tsx` file under `src/features/admin` and `src/features/parent`, `src/features/auth` using an arbitrary text size (mechanical, scripted — see Step 3)

- [ ] **Step 1: Register the scale**

Modify `src/app/globals.css`, inside the existing `@theme inline { … }` block (after the `--shadow-e3` line, following the file's existing convention of grouping related tokens with a comment):

```css
  /* Type scale — named tokens matching the sizes already in production use,
     replacing 250+ ad hoc text-[Npx] instances. 12px already has Tailwind's
     built-in text-xs; these seven cover everything else observed in the app. */
  --text-micro: 0.6875rem;   /* 11px — smallest labels (sidebar section footers) */
  --text-meta: 0.8125rem;    /* 13px — the workhorse: captions, table cells, breadcrumbs */
  --text-body: 0.9375rem;    /* 15px — emphasized body text, empty-state titles */
  --text-label: 1.0625rem;   /* 17px — card titles */
  --text-h4: 1.375rem;       /* 22px — page titles (the de facto H1 today) */
  --text-h3: 1.625rem;       /* 26px — section/stat headings (absorbs the 29px outlier — see Task 5 note) */
  --text-h1: 2.5rem;         /* 40px — auth screen hero (AuthShell) */
```

This registers `text-micro`, `text-meta`, `text-body`, `text-label`, `text-h4`, `text-h3`, `text-h1` as real Tailwind utilities, the same mechanism already used for every `--color-*` token in this file.

- [ ] **Step 2: Verify the tokens compile**

```bash
npx next build
```
Expected: succeeds. (Tailwind v4 only generates a utility once it's referenced somewhere, so add one throwaway `<span className="text-h1">` temporarily to a page, confirm it renders at 40px in devtools, then remove it — or just proceed to Step 3, which uses the classes for real immediately after.)

- [ ] **Step 3: Run the scripted migration**

This repo already has precedent for exactly this kind of mechanical class migration (the 384-replacement arbitrary→canonical spacing pass from the pixel-perfect audit). Same approach here. From `edufusionbd-web/`:

```powershell
$map = @{
  'text-\[11px\]' = 'text-micro'
  'text-\[12px\]' = 'text-xs'
  'text-\[13px\]' = 'text-meta'
  'text-\[15px\]' = 'text-body'
  'text-\[17px\]' = 'text-label'
  'text-\[22px\]' = 'text-h4'
  'text-\[26px\]' = 'text-h3'
  'text-\[29px\]' = 'text-h3'
  'text-\[40px\]' = 'text-h1'
}
Get-ChildItem -Path src -Recurse -Include *.tsx | ForEach-Object {
  $content = Get-Content $_.FullName -Raw
  $original = $content
  foreach ($pattern in $map.Keys) {
    $content = $content -replace $pattern, $map[$pattern]
  }
  if ($content -ne $original) {
    Set-Content -Path $_.FullName -Value $content -NoNewline
    Write-Output "updated: $($_.FullName)"
  }
}
```

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit
npx next lint
npx next build
```

Manual smoke: open the Dashboard, Teacher List, and one auth screen (`/login`) in both light and dark, both `bn` and `en` locale — confirm nothing visibly shifted size (it shouldn't; the token values are the exact pixel values that were already there). Grep to confirm the sweep was complete:

```bash
grep -rn "text-\[1[1235]px\]\|text-\[17px\]\|text-\[22px\]\|text-\[26px\]\|text-\[29px\]\|text-\[40px\]" src --include=*.tsx
```
Expected: no output.

```bash
git add src/app/globals.css src
git commit -m "feat(design-system): publish a named type scale, migrate 250+ arbitrary text sizes onto it"
```

---

### Task 6: Ship a shared Breadcrumb component and roll it out

**Files:**
- Create: `src/shared/ui/Breadcrumb.tsx`
- Modify: `src/shared/ui/index.ts`
- Modify: every screen listed in the rollout checklist below

- [ ] **Step 1: Build the component**

Create `src/shared/ui/Breadcrumb.tsx`:

```tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

/** Navigation trail — the last item is always the current page (no link, aria-current). */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-meta text-text-muted">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {item.href && !last ? (
              <Link href={item.href} className="hover:text-text-secondary hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current={last ? "page" : undefined} className={last ? "text-text-secondary" : undefined}>
                {item.label}
              </span>
            )}
            {!last ? <ChevronRight size={12} aria-hidden /> : null}
          </span>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Export it**

Modify `src/shared/ui/index.ts`, add:

```ts
export { Breadcrumb, type Crumb } from "./Breadcrumb";
```

- [ ] **Step 3: Roll out — replace every hand-rolled breadcrumb-shaped div**

Two screens already hand-roll a local, unlinked breadcrumb trail; converge them onto the shared component. In `src/features/admin/certificate/components/SettingConfig.tsx`, replace:

```tsx
-        <div className="flex items-center gap-1.5 text-[13px] text-text-muted"><span>{t("সার্টিফিকেট", "Certificate")}</span><span>›</span><span className="text-text-secondary">{breadcrumb}</span></div>
+        <Breadcrumb items={[{ label: t("সার্টিফিকেট", "Certificate"), href: "/admin/certificate/template" }, { label: breadcrumb }]} />
```

Add `Breadcrumb` to its `@/shared/ui` import.

Then apply the same shape (a two-or-three-level trail: section → sub-section → current page, using the `bn`/`en` strings already in `adminNav.ts` for that route) to every list/detail screen that currently has no breadcrumb at all. Checklist, one `<Breadcrumb>` insertion each, same pattern as Task 1's Audit Log screen and Task 3's Teacher List:

- [ ] `src/features/admin/dashboard/screens/overview/OverviewScreen.tsx`
- [ ] `src/features/admin/student/screens/registration/RegistrationScreen.tsx`
- [ ] `src/features/admin/student/screens/update-basic/UpdateBasicScreen.tsx`
- [ ] `src/features/admin/student/screens/update-class/UpdateClassScreen.tsx`
- [ ] `src/features/admin/student/screens/reports-summary/ReportsSummaryScreen.tsx`
- [ ] `src/features/admin/teacher/screens/registration/RegistrationScreen.tsx`
- [ ] `src/features/admin/teacher/screens/update-profile/UpdateProfileScreen.tsx`
- [ ] `src/features/admin/attendance/screens/report/ReportScreen.tsx`
- [ ] `src/features/admin/attendance/screens/analytics/AnalyticsScreen.tsx`
- [ ] `src/features/admin/fee/screens/*/​*.tsx` (8 screens — quick-collection-list, quick-collection-form, digital-collection, unpaid-section, unpaid-institute, income-statement, fee-mapping, delete-fees)
- [ ] `src/features/admin/sms-notice/screens/*/​*.tsx` (5 screens)
- [ ] `src/features/admin/core/screens/*/​*.tsx` (7 screens)

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit
npx next lint
npx next build
```
Manual smoke: spot-check 3–4 screens across different modules, confirm the trail renders and the non-last links navigate correctly.

```bash
git commit -am "feat(design-system): add shared Breadcrumb component, roll out across admin screens"
```

---

### Task 7: Extend server-side pagination to the other unbounded lists

Task 3 proved the pattern. `grep -rn "\.range(" src/features/admin` returns zero matches anywhere in the codebase today — every list fetch is unpaginated. Most are bounded by nature (one class section's roster, one exam's results, one migration batch) and don't need this. Two are genuinely unbounded and grow for the life of the institution:

- [ ] `fetchDigitalTransactions` (`src/features/admin/fee/logic/api.ts:182`) — a transaction log that grows on every digital fee payment, forever. Apply the exact Task 3 pattern: add `{page, perPage}` params, `.range()`, `{count: "exact"}`, wire the consuming screen (`DigitalCollectionScreen.tsx`) to `<Pagination>`.
- [ ] `fetchUsers` (`src/features/admin/core/logic/api.ts:79`) — lower urgency (admin/staff account count is small relative to students), but apply the same pattern for consistency once the two above are done, so "every list screen paginates the same way" is actually true rather than true-with-exceptions.

Each of these is its own Task-3-shaped unit of work (new debounced search state if the screen has one, `.range()` in the api function, `<Pagination onPageChange>` in the screen) — don't batch them into one diff; verify and commit each independently, same as Task 3's Step 5.

---

# PHASE 3 — Enterprise Feature Parity (Medium)

### Task 8: Bulk actions on the Teacher list

Demonstrates the pattern once, on the screen the audit already used as its running example. Selection state lives in the screen, not in the shared `Table` primitive (`Table` stays generic — a checkbox column is just another `<TH>`/`<TD>`).

**Files:**
- Modify: `src/features/admin/teacher/screens/list/ListScreen.tsx`

- [ ] **Step 1: Add selection state and a checkbox column**

```tsx
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    setSelected((s) => (s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
```

Add a checkbox `<TH>` before the "Teacher" column:

```tsx
<TH className="w-10">
  <input
    type="checkbox"
    checked={rows.length > 0 && selected.size === rows.length}
    onChange={toggleAll}
    aria-label={t("সব নির্বাচন করুন", "Select all")}
  />
</TH>
```

And a matching `<TD>` per row:

```tsx
<TD>
  <input
    type="checkbox"
    checked={selected.has(r.id)}
    onChange={() => toggleOne(r.id)}
    aria-label={t("নির্বাচন করুন", "Select row")}
  />
</TD>
```

- [ ] **Step 2: Add the bulk-action bar**

Directly above the `<Table>`, conditionally:

```tsx
{selected.size > 0 ? (
  <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary-subtle px-4 py-2.5 text-meta font-medium text-primary">
    <span>{t(`${selected.size} জন নির্বাচিত`, `${selected.size} selected`)}</span>
    <div className="ml-auto flex gap-2">
      <button
        onClick={() => { window.location.href = `/admin/sms-notice/send?recipients=${Array.from(selected).join(",")}`; }}
        className="rounded-md bg-surface px-3 py-1.5 text-text-primary hover:bg-sunken"
      >
        {t("এসএমএস পাঠান", "Send SMS")}
      </button>
      <button onClick={() => setSelected(new Set())} className="rounded-md px-3 py-1.5 hover:bg-sunken">
        {t("বাতিল", "Clear")}
      </button>
    </div>
  </div>
) : null}
```

`Send SMS` deep-links into the existing Send SMS screen with a `recipients` query param — the Send screen doesn't read that param yet; wiring it to pre-select those specific recipients is a follow-up inside the SMS module itself (out of scope for this task, which is about the Teacher list's selection UI), not a blocker for shipping selection.

- [ ] **Step 3: Verify and commit** — same three commands as every prior task, manual smoke: select a few rows, confirm the bar appears with the right count, confirm "Clear" empties it.

```bash
git commit -am "feat(admin): add row selection + bulk-action bar to Teacher list"
```

Rollout checklist for the same pattern once proven here: Student list-equivalent screens, `unpaid-section`/`unpaid-institute` (bulk reminder SMS is the obvious action there).

---

### Task 9: CSV export as a shared primitive

Replaces "only the Fee module has ad hoc PDF bars" with one reusable, dependency-free utility.

**Files:**
- Create: `src/shared/lib/exportCsv.ts`
- Modify: `src/features/admin/teacher/screens/list/ListScreen.tsx` (first consumer)

- [ ] **Step 1: Write the utility**

Create `src/shared/lib/exportCsv.ts`:

```ts
/**
 * Client-side CSV download — no server round-trip, no new dependency.
 * The UTF-8 BOM prefix matters here specifically: this app is bilingual
 * Bengali/English, and Excel silently mangles Bengali text in a BOM-less CSV.
 */
export function exportCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Wire the first consumer**

In `ListScreen.tsx`, add an Export button next to the search toolbar:

```tsx
<button
  onClick={() => exportCsv(`teachers-${new Date().toISOString().slice(0, 10)}.csv`, rows.map((r) => ({
    Name: r.name_en,
    Email: r.email ?? "",
    Designation: r.designation ?? "",
    Department: r.department ?? "",
    Status: r.status,
  })))}
  className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-2.5 text-meta font-medium text-text-secondary hover:bg-sunken"
>
  <Download size={14} /> {t("এক্সপোর্ট", "Export")}
</button>
```

Add `Download` to the `lucide-react` import and `exportCsv` to the `@/shared/lib/exportCsv` import.

Note this exports only the current page's rows post-Task-3 (server pagination), which is the correct default for a button labeled "Export" next to a paginated table — if "export all matching rows regardless of page" is wanted later, that's a separate server-side export endpoint, not a client-side change to this button.

- [ ] **Step 3: Verify and commit** — same three commands, manual smoke: click Export, confirm a CSV downloads and opens correctly in Excel/Sheets with Bengali names intact.

Rollout checklist: same button, same pattern, on every list screen from the Task 6 breadcrumb checklist that manages a real dataset (skip pure config/settings screens — export doesn't mean anything there).

---

### Task 10: Command palette (Ctrl+K)

Replaces the removed topbar Search slot (Task 2) with something that actually works: fuzzy navigation across the 56 admin routes, no new dependency (plain string matching is enough at this scale).

**Files:**
- Create: `src/features/admin/core/components/CommandPalette.tsx`
- Modify: `src/features/admin/components/AdminShell.tsx` (mount it, restore a Search button that opens it)

**Interfaces:**
- Consumes: `ADMIN_NAV_SECTIONS`, `ADMIN_NAV_FOOTER` from `./adminNav` (already imported in `AdminShell.tsx`).

- [ ] **Step 1: Flatten the nav into a searchable list and build the palette**

Create `src/features/admin/core/components/CommandPalette.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { ADMIN_NAV_SECTIONS, ADMIN_NAV_FOOTER, type AdminNavItem, type AdminSubItem } from "@/features/admin/components/adminNav";

type Entry = { href: string; label: string };

function flatten(): Entry[] {
  const out: Entry[] = [];
  const addSub = (s: AdminSubItem) => out.push({ href: s.href, label: `${s.bn} ${s.en}` });
  const addItem = (i: AdminNavItem) => {
    out.push({ href: i.href, label: `${i.bn} ${i.en}` });
    i.sub?.forEach((group) => group.items.forEach(addSub));
  };
  ADMIN_NAV_SECTIONS.forEach((s) => s.items.forEach(addItem));
  ADMIN_NAV_FOOTER.forEach(addItem);
  return out;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, isBn } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const entries = useMemo(flatten, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return entries.slice(0, 8);
    return entries.filter((e) => e.label.toLowerCase().includes(term)).slice(0, 8);
  }, [q, entries]);

  useEffect(() => {
    if (open) { setQ(""); requestAnimationFrame(() => inputRef.current?.focus()); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const go = (href: string) => { router.push(href); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
      <button type="button" aria-label={t("বন্ধ করুন", "Close")} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div role="dialog" aria-modal="true" aria-label={t("কমান্ড প্যালেট", "Command palette")} className="relative z-10 w-full max-w-lg rounded-2xl border border-border-default bg-surface shadow-e3">
        <div className="flex items-center gap-2.5 border-b border-border-default px-4 py-3">
          <Search size={17} className="text-text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("স্ক্রিন খুঁজুন…", "Jump to a screen…")}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-meta text-text-muted">{t("কিছু পাওয়া যায়নি", "No matches")}</li>
          ) : (
            results.map((r) => (
              <li key={r.href}>
                <button
                  onClick={() => go(r.href)}
                  className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-text-primary hover:bg-sunken"
                >
                  {isBn ? r.label.split(" ")[0] : r.label.split(" ").slice(1).join(" ")}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount it in the shell and restore a working Search button**

Modify `src/features/admin/components/AdminShell.tsx`:

```ts
import { CommandPalette } from "./CommandPalette";
```

Inside `AdminShell`:

```ts
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
```

Re-add a Search button in the topbar (where Task 2 removed the dead one), this time wired for real:

```tsx
          <button
            type="button"
            aria-label={tx("অনুসন্ধান", "Search")}
            onClick={() => setPaletteOpen(true)}
            className="grid size-9 place-items-center rounded-lg border border-border-strong text-text-secondary hover:bg-sunken"
          >
            <Search size={18} />
          </button>
```

Re-add the `Search` import to the `lucide-react` line, and mount the palette once, near the end of the component's JSX (sibling to the mobile drawer block):

```tsx
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
npx next lint
npx next build
```
Manual smoke: press Ctrl+K (or Cmd+K on Mac) from any admin screen, confirm the palette opens and is focused; type part of a screen name in both locales, confirm it filters; click a result, confirm navigation; press Escape, confirm it closes; click the topbar Search icon, confirm it also opens the palette.

```bash
git commit -am "feat(admin): add Ctrl+K command palette, restore a working topbar Search"
```

---

### Task 11: Close the remaining i18n gap

30 of 70 admin files have zero `useT()` usage. Rather than list all 30 blind, the accurate list (files with no `useT` import today) needs a fresh grep at execution time, since Phase 1–3 tasks above will have already converted a few of them incidentally:

```bash
comm -23 <(find src/features/admin -name "*.tsx" | sort) <(grep -rl "useT()" src/features/admin --include=*.tsx | sort)
```

For each file in that output: wrap every hardcoded Bengali or English string literal in JSX with `t(bn, en)`, wrap every user-visible number with `n(...)`, following the exact pattern already in `ListScreen.tsx` or `AuditLogScreen.tsx` above. This is mechanical per-file work with no shared abstraction to build — budget roughly 10–20 minutes per screen depending on how much text it has, verify each with `tsc`/`lint` as you go rather than batching all 30 into one diff (a typo in string extraction is much easier to spot in a 1-file diff than a 30-file one).

---

# PHASE 4 — Verification & Polish (Low)

### Task 12: Decide on automated test coverage (explicit decision point)

This repo has shipped its entire feature set so far without a test framework, verified instead by `tsc`/`lint`/`build` plus manual smoke passes — which is what every task above also does. Adding Vitest now is a real, separate infrastructure decision, not a mechanical follow-on:

- **If skipped:** nothing to do, the project continues as-is.
- **If wanted:** `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`, one `vitest.config.ts` pointing at the existing `tsconfig.json` paths, one `test` script in `package.json`, and start with exactly one real test — `useDebouncedValue` (Task 3) is the cleanest candidate: a pure hook, easy to assert on with fake timers, and it's now reused by every paginated list screen, so a regression there is genuinely worth catching automatically.

Don't build this speculatively for the other 11 tasks in this plan — add a second test only when a second piece of logic in this codebase actually bites someone in a way `tsc`/manual smoke didn't catch.

### Task 13: CSP nonce

`next.config.mjs` already documents this as a known follow-up (`script-src 'self' 'unsafe-inline'`). Swap to a per-request nonce via middleware: generate a random nonce in `src/middleware.ts` (already exists per the 07-18 auth work), pass it through a response header, read it in `src/app/layout.tsx` to stamp `<Script nonce={...}>` where needed, and change the CSP header to `script-src 'self' 'nonce-${nonce}'`. This one genuinely needs its own focused pass with the actual middleware file open — not blind-authored here without reading `src/middleware.ts` first.

### Task 14: Living style-guide page

Create `src/app/(admin)/admin/_styleguide/page.tsx` (underscore-prefixed folder — Next.js route convention for excluding from typical nav, keep it out of `adminNav.ts`) rendering one example of every `shared/ui` export — `Button` in every variant, `Badge` in every tone, `Table` with sample rows, `Modal`, `Toast`, the new `Breadcrumb`, the type scale from Task 5 as a literal specimen sheet. Gate it behind the existing admin auth (it's already inside `(admin)`, so it inherits the role-gate middleware) rather than a new permission.

### Task 15: Hover/pressed-state audit

Grep every custom `<button>` in `src/features/admin` that doesn't use the `Button` primitive (`grep -rL "shared/ui" ... | grep -l "<button"` as a starting filter, refine by hand), compare its hover/active/disabled styling against `Button.tsx`'s, and either migrate it to `<Button>` or bring its ad hoc classes in line. This is the same "converge on the primitive" motion as Task 6's Breadcrumb rollout, applied to buttons instead.

---

## Spec coverage

Every item from the 2026-07-20 audit's Section G roadmap maps to a task above:

| Audit roadmap item | Task |
|---|---|
| Audit Log screen | Task 1 |
| Kill dead controls | Task 2 |
| Live SMS balance | Task 2 |
| Server-scoped queries | Task 3, Task 7 |
| Named type scale + migration | Task 5 |
| Finish responsive coverage | *not covered — see note below* |
| Breadcrumb component | Task 6 |
| Bulk actions | Task 8 |
| i18n to 100% | Task 11 |
| CSV/Excel export | Task 9 |
| Command palette | Task 10 |
| axe/Lighthouse CI gate | *not covered — see note below* |
| ConfirmDialog coverage audit | *not covered — see note below* |
| Session idle-timeout UI | *not covered — see note below* |
| CSP nonce | Task 13 |
| Style-guide page | Task 14 |
| Hover/pressed-state audit | Task 15 |

Four items are intentionally not turned into tasks here, each for a reason worth stating rather than silently dropping:
- **Finish responsive coverage (37 files)** — genuinely needs a per-screen visual check in a real viewport, which this plan (authored without running the dev server) can't respons ibly script sight-unseen. Treat it as its own follow-up pass: open each of the 37 files from the audit's grep list at 375px/768px/1440px and fix what breaks, same triage the AdminShell responsive fix already used as a model.
- **axe/Lighthouse CI gate** — a CI pipeline doesn't exist yet in this repo at all (no `.github/workflows`), so this is really "add CI" as a prerequisite, which is its own decision (which CI provider, deploy target) outside this plan's scope.
- **ConfirmDialog coverage audit** — needs a human judgment call per destructive action (is this actually destructive enough to gate?), not a mechanical diff.
- **Session idle-timeout UI** — depends on a session-length/re-auth policy decision (how many minutes, what re-auth flow) that's a product call, not an engineering one.

Flag any of these four if you want them turned into a concrete task next — each is small once the underlying decision is made.
