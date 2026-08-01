# Admin Settings Module — Requirements Analysis, Architecture & UI/UX Audit

**Scope:** `/admin/core/*` — 11 screens (the "Settings" module, `ADMIN_SETTINGS_MODULE`, permission `core.settings`)
**Date:** 2026-08-01
**Method:** full source read of all 11 screens + shared data layer + nav/permission layer, cross-checked against the **live** Supabase project `dkumhtrrgsuwxucgncix` (schema, RPC bodies, RLS guards, storage config, advisors, row counts).
**Audience:** CTO / Principal Architect / Tech PM / implementing engineers.

---

## 0. Executive summary

### 0.1 What the module is

| # | Screen | Route | Feature file | Group |
|---|--------|-------|--------------|-------|
| 1 | Basic Config | `/admin/core/basic-config` | `BasicConfigScreen.tsx` (222 L) | Institution |
| 2 | StartUp | `/admin/core/startup` | `StartupScreen.tsx` (194 L) | Institution |
| 3 | Class Config | `/admin/core/class` | `ClassScreen.tsx` (191 L) | Institution |
| 4 | Academic Calendar | `/admin/core/calendar` | `CalendarScreen.tsx` (469 L) | Institution |
| 5 | Signature | `/admin/core/signature` | `SignatureScreen.tsx` (136 L) | Institution |
| 6 | Subject List | `/admin/core/subject` | `SubjectScreen.tsx` (171 L) | Subjects |
| 7 | Subject Group | `/admin/core/subject-group` | `SubjectGroupScreen.tsx` (106 L) | Subjects |
| 8 | Grading Scheme | `/admin/core/grading` | `GradingScreen.tsx` (213 L) | Subjects |
| 9 | Users & Roles | `/admin/core/user-list` | `UserListScreen.tsx` (357 L) | Users |
| 10 | Permission Matrix | `/admin/core/permissions` | `PermissionMatrixScreen.tsx` (198 L) | Users |
| 11 | Audit Log | `/admin/core/audit-log` | `AuditLogScreen.tsx` (266 L) | Users |

Total: **~2,523 lines of screen code + 282 lines of data access + 129 lines of hooks.**

### 0.2 Scorecard

| Dimension | Score | Note |
|---|---|---|
| Functional completeness | 58 / 100 | Calendar is non-functional in production; no invite/reset user flows; no settings hub |
| Data-layer correctness | 74 / 100 | RPCs guarded and tenant-scoped, but whole-blob writes and no optimistic concurrency |
| Security & access control | 61 / 100 | One unguarded RPC, one coarse permission gating 11 screens, unbounded storage bucket |
| Validation & error handling | 42 / 100 | 2 of 11 screens validate anything beyond "name required" |
| Accessibility (WCAG 2.2 AA) | 55 / 100 | Tables and live regions are excellent; toggles, calendar grid and dialogs are not |
| Design-system consistency | 63 / 100 | Tokens exist and are good; adoption across these 11 screens is uneven |
| Information architecture | 48 / 100 | Flat 11-tab strip, no hub, no search, no grouping surfaced in the UI |
| Performance & scalability | 66 / 100 | Fine at 1 institution; unpaginated lists and per-render signed-URL fetches will not hold |
| Observability & testability | 30 / 100 | 2 pure-logic unit tests; zero screen tests; zero settings RLS assertions |
| Production readiness | **52 / 100** | **Not shippable as-is** — three Critical items below |

### 0.3 The five things that matter most

| ID | Finding | Priority |
|---|---|---|
| **C-1** | **The Academic Calendar screen is dead in production.** All six of its RPCs do not exist in the live database. It also silently breaks `useDayStatus`, which the attendance module depends on. | **Critical** |
| **C-2** | **`fn_permission_matrix` is `SECURITY DEFINER`, executable by every `authenticated` user, with no permission guard.** The complete role×capability map of the institution is readable by any signed-in account, including teachers and parents. | **Critical** |
| **C-3** | **Settings writes are last-write-wins over an entire JSON document.** `fn_save_setting` does `value = excluded.value`. Two admins in `basic_config` at once, and one silently erases the other's whole configuration — grading scheme, pass mark, currency, every toggle. | **Critical** |
| **H-1** | **One permission (`core.settings`) gates all 11 screens**, including Users & Roles and Audit Log, which the database gates on `core.user_manage` and `audit.read`. The UI shows tabs the caller cannot use, and renders them as empty results rather than "no access". | **High** |
| **H-2** | **The `institution-assets` storage bucket has no size limit and no MIME allow-list** (`file_size_limit = null`, `allowed_mime_types = null`), and the client uploader validates neither. The UI promises "up to 1 MB"; nothing enforces it. | **High** |

### 0.4 Verified evidence (live database, 2026-08-01)

```
functions matching %calendar% or %term% in any schema   → 1  (pg_catalog.pg_terminate_backend only)
public.academic_calendar                                 → exists, 0 rows
public.academic_term                                     → exists, 1 row
fn_permission_matrix  secdef=true  guard=false  authenticated_can_execute=true
all other core RPCs   secdef=true  guard=require_permission('core.settings'|'core.user_manage')
storage.buckets['institution-assets']  public=false  file_size_limit=null  allowed_mime_types=null
advisors(security): 75 × authenticated_security_definer_function_executable (WARN)
                     1 × anon_security_definer_function_executable (fn_verify_document — intentional)
                     1 × auth_leaked_password_protection disabled (WARN)
                     6 × rls_enabled_no_policy (INFO — partition defaults, documented)
row counts: profile=1  role=4  permission=29  signature=0  setting=1
            class=12  subject=5  grade_scheme=1  audit_log=1916
```

Two of those counts are themselves findings. **`profile = 1`** means the entire institution still runs on one shared credential — which is exactly the problem `UserListScreen`'s own header comment says the screen exists to solve, and it remains unsolved because there is no invite flow. **`signature = 0`** means every marksheet and certificate the product prints today is unsigned.

---

## 1. Cross-cutting findings (module level)

Findings are numbered `M-n`. Each carries Problem / Root cause / Business impact / Solution / Benefit / Priority.

---

### M-1 · Academic Calendar calls six RPCs that do not exist — **Critical**

**Problem.** `CalendarScreen` and `logic/calendar.ts` call `fn_calendar_range`, `fn_calendar_day`, `fn_set_calendar_range`, `fn_clear_calendar_range`, `fn_upsert_term`, `fn_delete_term`. None of them exist in the live database. Every one returns PostgREST 404, so the screen renders its `ErrorState`, the month grid never paints marks, and no holiday or term can be saved. `academic_calendar` has 0 rows, which is consistent with a screen that has never successfully written.

**Root cause.** Migration `20260801096000_academic_calendar.sql` exists in the repository but its function DDL is not present in the deployed schema. The repo has 64 migration files and the project reports 64 applied migrations, but the recorded versions do not correspond one-to-one — the deploy path (`apply_migration` via MCP versus `supabase db push`) has been mixed, so "migration count matches" was never proof that "the schema matches". Nothing in CI asserts that every RPC the client calls actually exists.

**Business impact.** A school cannot declare Eid holidays. Attendance is takeable on non-teaching days, the 30-day dashboard averages are diluted by holidays, and `useDayStatus` — consumed by the attendance screens, not just Settings — fails for them too. This is the single largest correctness hole in the module and it leaks outside the module.

**Solution.**
1. Re-apply `20260801096000_academic_calendar.sql` against the live project and verify each function with `to_regprocedure`.
2. Add a **contract test** that enumerates every `.rpc("fn_…")` call site in `src/` and asserts the function exists in the schema. This is a ~40-line test that would have caught this on the commit that introduced it.
3. Add `supabase db diff --linked` to CI as a drift gate.

**Expected benefit.** Calendar becomes functional; attendance statistics become defensible; an entire class of "the screen was built but the migration never landed" defects becomes impossible to merge.

**Priority: Critical.**

---

### M-2 · `fn_permission_matrix` has no authorization guard — **Critical**

**Problem.** Every other Settings RPC begins with `perform private.require_permission('core.settings')` (or `'core.user_manage'`). `fn_permission_matrix` does not. It is `SECURITY DEFINER`, owned by `postgres` (which carries `rolbypassrls = true`, so RLS does not apply inside it), and `EXECUTE` is granted to `authenticated`. Any signed-in user of the tenant — a teacher, an accountant, a parent — can call it and receive the complete `role`, `permission` and `role_permission` map.

**Root cause.** The guard was applied by a later hardening pass that swept the write RPCs. `fn_permission_matrix` is a read, so it was not in that sweep. There is no lint or test that asserts "every `SECURITY DEFINER` function in `public` either calls `require_permission` or is explicitly listed as intentionally open".

**Business impact.** Disclosure of the institution's authorization model. Not catastrophic on its own — it is configuration, not student data — but it is precisely the reconnaissance an attacker wants, it contradicts the product's own access story during procurement review, and it is a finding any external security assessment will raise.

**Solution.**
```sql
create or replace function public.fn_permission_matrix() returns jsonb
language plpgsql security definer set search_path to '' as $$
begin
  perform private.require_permission('core.user_manage');
  return private.fn_permission_matrix();
end; $$;
```
Then add a pgTAP assertion: for every `prosecdef` function in `public`, either `prosrc ilike '%require_permission%'` or the name is on an explicit allow-list (`fn_verify_document`, `fn_my_permissions`).

**Expected benefit.** Closes the hole and, more valuably, converts "we remembered to guard it" into a mechanically enforced invariant across all 75 `SECURITY DEFINER` functions the advisor currently flags.

**Priority: Critical.**

---

### M-3 · Settings writes are last-write-wins over a whole JSON document — **Critical**

**Problem.** `fn_save_setting` is:
```sql
insert into public.setting(institution_id, key, scope, value, updated_at) values (…)
on conflict (institution_id, key, scope) do update set value = excluded.value, updated_at = now();
```
`BasicConfigScreen` loads the entire `basic_config` blob into React state and re-sends all of it on save. Two administrators open Basic Config at 09:00. One changes the pass mark and saves at 09:05. The other changes the currency and saves at 09:06 — sending the blob they loaded at 09:00, which still contains the *old* pass mark. The first admin's change is gone, silently, with a green "Saved" toast.

The same shape applies to `institution.metadata`, though with the opposite failure: it is merged with `||`, so a key written once can **never be removed**.

**Root cause.** No optimistic concurrency control. The `setting` row has `updated_at` but the client neither reads nor sends it. The screen's data model is "the whole document" rather than "the fields I changed".

**Business impact.** Silent, unattributable configuration loss. In an institution with a head teacher and an office administrator both holding `core.settings`, this will happen. The audit log records both writes as legitimate `UPDATE`s, so the loss is invisible until a grade is processed against a pass mark nobody set.

**Solution.**
1. Add `p_expected_updated_at timestamptz` to `fn_save_setting`; raise a distinguishable exception (`setting_conflict`) when it does not match the stored value.
2. In the client, surface that as a non-destructive conflict dialog: *"This page was changed by <name> at <time>. Reload and re-apply your changes, or overwrite."* — never a silent overwrite.
3. Send only changed keys (`jsonb` merge server-side) so two admins editing *different* fields do not conflict at all.
4. For `institution.metadata`, support explicit key removal (`payload->'metadata_unset'` as a text array).

**Expected benefit.** Concurrent administration becomes safe. This is table stakes for any multi-administrator SaaS and is the difference between "a settings screen" and "a settings system".

**Priority: Critical.**

---

### M-4 · One coarse permission gates eleven screens — **High**

**Problem.** `ADMIN_SETTINGS_MODULE.permission = "core.settings"`. Individual `tabs` entries carry `href`, `bn`, `en`, `group` — and no `permission` field at all. But the database gates `profile` / `user_role` / `role_permission` writes on `core.user_manage` and `audit_log` reads on `audit.read`. So a user holding `core.settings` alone sees the Users & Roles and Audit Log tabs, clicks them, and gets an empty table — not a refusal. Conversely `canSeeModule` **fails open** by design (documented at `adminNav.ts:270`): an empty permission array shows everything.

Route level is no better: `middleware.ts` admits `admin | teacher | super_admin` to all of `/admin/*`. A teacher can navigate directly to `/admin/core/user-list`. RLS correctly returns nothing, so there is no data leak — but the user is shown a screen that looks broken rather than one that says "you do not have access".

**Root cause.** The nav model was designed at module granularity before the 29-permission model landed. `AdminModuleTab` was never extended.

**Business impact.** Support load ("the user list is empty"), a confusing least-privilege story during procurement, and an authorization model that is real in the database but invisible in the product.

**Solution.**
1. Add `permission?: string` to the tab type; set `core.user_manage` on `user-list` + `permissions`, `audit.read` on `audit-log`, `core.settings` on the other eight.
2. Filter `ModuleTabs` on `useMyPermissions()` using the same fail-open semantics as `canSeeModule`.
3. Add a shared `<NoAccessState>` and render it — not `EmptyState` — when a query returns zero rows *and* the caller lacks the permission. "Nothing here" and "not for you" must not look identical.
4. Keep the module-level fail-open behaviour; it is deliberate and correct for rollout.

**Expected benefit.** The rail becomes an honest map of what the user can do; a genuine least-privilege demo becomes possible.

**Priority: High.**

---

### M-5 · Storage bucket accepts unbounded uploads of any type — **High**

**Problem.** `storage.buckets['institution-assets']` has `file_size_limit = null` and `allowed_mime_types = null`. `uploadInstitutionAsset()` performs no size check, no MIME check, and interpolates the raw `file.name` into the object path. The `accept=` attribute on the file inputs (`image/png,image/svg+xml` for the logo, `image/png` for signatures) is a picker hint that any scripted client ignores. The UI copy promises "PNG/SVG • up to 1 MB" and "PNG (transparent) • up to 500KB"; nothing enforces either.

**Root cause.** The bucket was created without constraints and the helper was written for the happy path.

**Business impact.** Any authenticated user can consume unbounded storage in the tenant's prefix — a cost and availability problem. Accepting `image/svg+xml` for the logo also means storing script-capable content; it is rendered through `<img src>`, which neutralises script execution, so this is a storage-abuse issue rather than an XSS one — but it should not be stored unvalidated regardless. Unsanitised filenames in object paths are a second, smaller hygiene problem.

**Solution.**
1. Set `file_size_limit = 1048576` and `allowed_mime_types = ARRAY['image/png','image/svg+xml','image/jpeg']` on the bucket.
2. In `uploadInstitutionAsset`, validate `file.size` and `file.type` before upload and throw a typed, translated error.
3. Slugify the filename; keep the original in `file_object.metadata` if it is needed for display.
4. Downscale client-side before upload — `src/shared/lib/imageResize.ts` already exists and is already tested; reuse it rather than writing anything new.
5. Show the constraint as validation feedback, not just as caption text.

**Expected benefit.** Predictable storage cost, enforced product promises, and a logo pipeline that produces consistently sized assets for marksheet headers.

**Priority: High.**

---

### M-6 · `/admin/core` has no landing page and the module has no hub — **High**

**Problem.** There is no `src/app/(admin)/admin/core/page.tsx`. `/admin/core` 404s. The module's `href` points at `/admin/core/basic-config`, so the first thing an administrator sees when they click "Settings" is a form. Eleven tabs are presented as one flat strip, even though `adminNav.ts` already carries the `group` metadata (Institution / Subjects / Users) that would organise them.

**Root cause.** The module grew screen by screen; no one owned the module's own information architecture.

**Business impact.** Settings is the module a new administrator meets during onboarding and the one they return to least often. A flat strip of 11 unfamiliar labels with no descriptions, no status, and no search is the single largest contributor to "I don't know where that setting is" support tickets. It also hides the module's biggest onboarding signal: that 0 signatures are configured and the calendar is empty.

**Solution.** Build a **Settings hub** at `/admin/core`:
- Three grouped card sections (Institution / Academic / Access & Governance), each card showing the screen name, a one-line description, and a **live status chip** — "12 classes", "5 subjects", "⚠ 0 signatures", "⚠ calendar not set up", "1 user".
- A settings search box that filters across screen names *and* individual setting labels, deep-linking to `/admin/core/basic-config#pass_mark`.
- A "Setup checklist" strip for a fresh institution: institution identity → classes → subjects → grading → calendar → signatures → users. Percentage complete.

**Expected benefit.** Turns Settings from a filing cabinet into a guided surface; makes incomplete configuration visible instead of discoverable only by failure; gives sales a demonstrable onboarding story.

**Priority: High.**

---

### M-7 · Validation is present on 2 of 11 screens — **High**

**Problem.** Only `BasicConfigScreen` (four numeric range rules) and `GradingScreen` (`validateGradeScale`) validate anything. Everywhere else the entire contract is a `"Name required"` toast. Concretely, the product currently accepts:

| Screen | Accepted invalid input | Downstream effect |
|---|---|---|
| StartUp | EIIN of any shape; `not-an-email`; `established_year = 99999`; any string as a website | Garbage in every marksheet/certificate header; board submissions rejected |
| Subject | `pass_marks > full_marks`; negative marks; `min_class_level > max_class_level` | A subject nobody can pass; a subject applicable to no class |
| Class | `numeric_level` duplicated across classes; section capacity `0` or below current enrolment | Ambiguous class ordering; capacity that reports as over-subscribed forever |
| Subject Group | A group with zero subjects; duplicate group names | Silent no-op in elective assignment |
| Calendar | `to < from` (only `min` on the input — not enforced on submit) | A range that marks nothing, reported as success |
| Signature | Any file the picker allows; empty holder name | Blank signature block on printed certificates |

There is a shared zod layer (`src/shared/lib/validation.ts`, `useZodForm`) already in use by Student, Teacher, Fee and SMS. **Settings adopted none of it.**

**Root cause.** Settings screens were written before the zod trust-boundary work and were never retrofitted.

**Business impact.** Invalid configuration is not a local bug — it is upstream of exam processing, certificate printing and fee scheduling. `pass_marks > full_marks` produces a cohort with zero passes, and the defect surfaces weeks later in the results screen, where it will be diagnosed as a results bug.

**Solution.** One zod schema per screen in `logic/schemas.ts`, wired via the existing `useZodForm`, with:
- Field-level errors on blur (the `bind()` pattern in `BasicConfigScreen` is the right shape — generalise it into a shared hook).
- Cross-field rules (`pass_marks <= full_marks`, `min_class_level <= max_class_level`, `to >= from`).
- Server-side mirror in the RPCs — the client is UX, the database is the control.

**Expected benefit.** Invalid configuration becomes unrepresentable; the failure moves from "wrong results in week 6" to "red field in second 3".

**Priority: High.**

---

### M-8 · The data-interaction contract is honoured by 2 of 11 screens — **High**

**Problem.** `useDataScreen` + `DataToolbar` + `Pagination` + `LiveRegion` + `SortableTH` + `exportCsv` + URL-persisted state is the house pattern. Only **Users & Roles** and **Audit Log** implement it.

| Screen | Search | Filter | Sort | Pagination | URL state | Export | Live region |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Basic Config | – | – | – | – | – | – | – |
| StartUp | – | – | – | – | – | – | – |
| Class Config | – | – | – | – | – | – | – |
| Calendar | – | – | – | – | ✗ month is local state | – | – |
| Signature | – | – | – | – | – | – | – |
| Subject | ✗ raw input | ✗ raw select | – | – | – | – | – |
| Subject Group | – | – | – | – | – | – | – |
| Grading | – | ✗ raw select | – | – | – | – | – |
| Users & Roles | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Permissions | – | – | – | – | – | ✓ | ✓ |
| Audit Log | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Every list also fetches with `.limit(MAX_OPTIONS)` and displays no "showing N of M" — a school with 60 subjects sees a list that is silently truncated with no indication.

**Root cause.** The contract was introduced after most Settings screens shipped and backfilled only where an audit item named the screen explicitly.

**Business impact.** A subject list cannot be linked to a colleague in a filtered state. A grading scheme cannot be exported for the board. A truncated list looks complete. And the inconsistency itself is the cost: an administrator learns the toolbar on the user list and finds it absent two tabs away.

**Solution.** Retrofit `useDataScreen` + `DataToolbar` on Subject, Subject Group, Grading, Class and Signature. Add server-side `count: "exact"` and a `Pagination` where the row count can exceed a page. Replace the two raw `<input>`/`<select>` filter controls with the shared components.

**Expected benefit.** One interaction model across the admin app; shareable filtered URLs; honest counts.

**Priority: High.**

---

### M-9 · Accessibility: custom toggles, the calendar grid, and unlabelled controls — **High**

Verified WCAG 2.2 AA failures. The module gets a great deal right — real `<table>` semantics with `<th scope>`, `LiveRegion` announcements, `sr-only` text carrying the meaning of decorative icons in the permission matrix, `aria-label` on icon buttons — which makes the remaining gaps stand out as omissions rather than as a systemic problem.

| ID | Location | Failure | SC |
|---|---|---|---|
| A-1 | `BasicConfigScreen:200-207` (×4 toggles) | `<button>` styled as a switch with no `role="switch"` and no `aria-checked`. A screen reader announces "Parent SMS notifications, button" with no state, in either position. | 4.1.2 Name, Role, Value |
| A-2 | `SubjectScreen:159-164` | Same toggle pattern **and no accessible name at all** — it is wrapped in a `<label>`, but a `<label>` does not label a `<button>`. Announced as "button". | 4.1.2 |
| A-3 | `CalendarScreen:186-219` | The month is a `div` grid of 42 buttons. Each button's accessible name is the day number alone ("৫"). No month, no weekday, no holiday state. No `role="grid"`, no arrow-key navigation — reaching 28 April is 28 Tab presses. | 1.3.1, 2.1.1, 2.4.6 |
| A-4 | `BasicConfigScreen:104-114` | On a failed save the toast fires and fields turn red, but focus stays on the Save button. A keyboard or screen-reader user is told "Fix the highlighted fields" and given no route to them. | 3.3.1, 2.4.3 |
| A-5 | `SignatureScreen:91-97` | Save-on-blur. The success toast is the only feedback and it is not tied to the field; there is no way to cancel, and tabbing through the form fires four writes. | 3.3.2, 3.2.2 On Input |
| A-6 | `AuditLogScreen:250-258` | `<pre>` JSON dumps with no accessible name, no `tabindex="0"` on a scrollable region, and text at `text-xs` (12 px). | 1.3.1, 2.1.1 |
| A-7 | `PermissionMatrixScreen:104` | Table scrolls horizontally at `280 + roles × 150` px; the capability column is not sticky, so at 375 px the row's identity scrolls out of view. | 1.4.10 Reflow |
| A-8 | All 11 | No `metadata` export on any `page.tsx` — every Settings screen shares one browser-tab title. A screen-reader user with eleven tabs open cannot tell them apart. | 2.4.2 Page Titled |
| A-9 | `SubjectGroupScreen:94`, `GradingScreen:168` | Raw `<input type="checkbox">` instead of the shared `Checkbox`, which carries the focus-ring and hit-target treatment. | 2.4.7, 2.5.8 |

**Solution.** Build one shared `<Switch>` primitive (`role="switch"` + `aria-checked` + label association) and replace all five ad-hoc toggles. Rebuild the calendar month as a `role="grid"` with roving `tabindex` and full `aria-label`s ("১৫ এপ্রিল ২০২৬, বৃহস্পতিবার — ঈদুল ফিতরের ছুটি"); `src/shared/lib/useGridNavigation.ts` already exists and is already tested. Focus the first invalid field on failed save. Add `metadata` to all 11 pages. Make the matrix's first column `sticky left-0`.

**Priority: High** (A-1/A-2/A-3 are AA failures on a product sold to public institutions, where accessibility procurement requirements apply).

---

### M-10 · Design-system adoption is uneven inside the module — **Medium**

The design system itself is in good shape: a named type scale (`--text-micro` 11 px → `--text-h1` 40 px), semantic colour tokens, a contrast test at `src/app/contrast.test.ts`, and the `font-size-adjust: 0.51` Bangla/Latin parity fix with a `@supports` fallback. The problem is adoption.

| Inconsistency | Evidence |
|---|---|
| Page header: 9 screens use `PageHeader` with breadcrumbs; **Basic Config and StartUp use a raw `<header>` + `<h1>`** and have no breadcrumbs. | `BasicConfigScreen:119`, `StartupScreen:96` |
| Buttons: 10 screens use `<Button>`; **StartUp's SaveBar uses two raw `<button>`s** with hand-written classes duplicating the variant styles. | `StartupScreen:189-190` |
| Type scale: named tokens (`text-h4`, `text-body`, `text-meta`, `text-micro`) are mixed with Tailwind defaults (`text-sm`, `text-xs`, `text-base`, `text-lg`) in the same files. | `BasicConfigScreen:197-198`, `ClassScreen:114-115`, `SubjectGroupScreen:61` |
| Breadcrumb root label: "কোর সেটিংস / Core Settings" on 8 screens, "সেটিংস / Settings" on Audit Log. The rail says "সেটিংস / Settings". | `AuditLogScreen:104` vs `ClassScreen:88` |
| Filter controls: `DataToolbar` on 2 screens, hand-rolled `<select className={filterClass}>` on 2 others. | `SubjectScreen:85`, `GradingScreen:113` |
| Delete affordance: a text link with a trash icon (Class, Grading), an icon-only button in a table cell (Subject, Calendar), a bordered icon button in a card (Subject Group), and **absent entirely** (Signature). | five patterns, four screens |
| Empty state: `EmptyState` in a `rounded-2xl bg-surface p-5 shadow-e1` wrapper (Subject Group, Grading) vs bare `EmptyState` (Users) vs `TableEmpty` (Subject, Class). | four screens |

**Root cause.** No design-QA gate on this module and no lint rule for the type scale. The ESLint config already bans `shadow-e3`, raw hex and arbitrary values — the same mechanism can ban raw font-size utilities.

**Business impact.** Cumulative perception of unfinished software, and a maintenance tax: five delete patterns are five places to fix when the confirm copy changes.

**Solution.** Normalise all 11 screens onto `PageHeader` + `Button` + `DataToolbar` + one delete pattern. Add an ESLint rule banning `text-(xs|sm|base|lg|xl)` in `src/features/**`. Add a design-QA checklist to PR review (§4.14).

**Priority: Medium** (High if a design review or investor demo is imminent).

---

### M-11 · Unsaved-work protection is on one of two form screens — **Medium**

`BasicConfigScreen` calls `useUnsavedGuard(dirty)`. `StartupScreen` tracks `dirty` for the SaveBar and **does not call the guard**. Closing the tab mid-edit on institution identity — the data printed on every certificate — loses the work with no warning. `SignatureScreen` has no dirty concept at all (see A-5). One line to fix; the class of bug is "the second screen didn't get the treatment the first one did", which is what a checklist exists to prevent.

**Priority: Medium** (one-line fix, real data loss).

---

### M-12 · No tests for any Settings screen — **Medium**

The module has exactly two test files, both pure logic: `calendar.test.ts` (50 L) and `gradeScale.test.ts` (59 L). There are **zero** screen tests, zero a11y assertions, and zero pgTAP assertions covering `core.settings` enforcement — despite `supabase/tests/rls_roles.test.sql` existing as the place they belong. In a module where a wrong value silently corrupts exam processing for a whole cohort, this is the weakest link in the delivery pipeline.

**Solution.** Per screen: one render test (loads, shows data), one interaction test (edit → save → success), one validation test (invalid input → blocked). Plus the RPC-existence contract test from M-1, plus `core.settings` / `core.user_manage` / `audit.read` assertions in `rls_roles.test.sql`, plus `vitest-axe` on the five most complex screens.

**Priority: Medium.**

---

### M-13 · Performance and scalability characteristics — **Medium**

Real at scale, invisible today at 1 institution / 12 classes / 5 subjects.

| Issue | Evidence | Effect at 500 schools |
|---|---|---|
| Signed URLs re-fetched on every mount, sequentially, one per signature | `SignatureScreen:44-49` | 4 serial round-trips before the page is usable; 1-hour URLs re-minted on every navigation |
| No `staleTime` on the eight core list queries | `hooks.ts:13-21` (boards/teachers have 60 s; classes, subjects, groups, schemes, signatures, institution, settings have none) | Every tab switch refetches configuration that changes monthly |
| Unbounded `.limit(MAX_OPTIONS)` reads with no count | `api.ts` throughout | Silent truncation; no user signal |
| `fetchClassSections` uses a nested `count` aggregate per section | `api.ts:50-62` | N+1-shaped aggregate on a hot path |
| Subject filtering is client-side over the full fetched list | `SubjectScreen:58-65` | Filters only what was fetched — a filtered result that is wrong, not just slow |
| Permission matrix renders `roles × permissions` cells with no virtualisation | `PermissionMatrixScreen` | 4 × 29 = 116 cells today; custom roles make this 20 × 60 = 1,200 |

**Solution.** `staleTime: 5 * 60_000` on all configuration queries (they change monthly, not per-interaction — the same reasoning already applied to `useMyPermissions`). Batch signature URL signing into one `Promise.all` and cache by `file_file_id`. Move Subject filtering server-side with `count: "exact"`. Add `Showing N of M` to every capped list.

**Priority: Medium.**

---

### M-14 · Audit Log is a record, not an investigation tool — **Medium**

The screen is well-built for what it does — server-paged, URL-persisted filters, honest about page-only export, correct about the search box taking a record ID. But with 1,916 rows already and a log that only grows, the missing capabilities are the ones an investigation actually needs:

- **No date-range filter.** "What changed last week" is the most common audit question and it cannot be asked.
- **No actor filter.** "What did this user do" is the second most common and it cannot be asked either — even though the join to `profile` is already there.
- **No diff view.** Two raw `JSON.stringify` blobs side by side at 12 px. Finding which of 40 keys changed is manual.
- **No severity or category.** `fn_admin_reset_mfa` writes `severity: 'high'` into the payload and nothing surfaces it.
- **PII exposure.** `before`/`after` on a `student` row is the full record — phone, guardian, address — shown verbatim to anyone with `audit.read`, with no redaction and no log of who *read* the audit log.
- **No retention policy.** The table grows without bound and nothing archives it.

**Solution.** Add `from`/`to` date filters and a "changed by" select (both already available in the query). Replace the `<pre>` pair with a computed field-level diff (`key · before → after`, changed keys only, unchanged collapsed). Surface `severity`. Redact a configured key list (`phone`, `nid`, `dob`, `address`) behind a "reveal" that itself writes an access-log entry. Add a retention/archive job.

**Priority: Medium** (the PII item is High if the institution's data-protection posture is being reviewed).

---

### M-15 · Users & Roles is missing the operations that make it a user-management screen — **High**

`profile = 1` in the live database. The screen's own header comment identifies the problem precisely — "a school ran on one shared credential and every audit-log entry attributed to the same account" — and the reason it persists is that the screen has no **invite** flow, deliberately deferred because creating an auth user needs the service-role key from a server route.

That deferral is architecturally correct and no longer sufficient: without invite, none of the RBAC work (4 roles, 29 permissions, the whole permission matrix, `core.user_manage` guards) can be used by a real institution, because there is only ever one user to assign roles to. **The entire access-control investment is blocked on one server route.**

Also missing: send password reset, force password change at next sign-in, revoke active sessions, email column (only `full_name` / `phone` are shown), bulk role assignment, and a "pending invite" state. Client-side sorting over a server page (`UserListScreen:66-73`) is documented as deliberate, but sorting "last sign-in" across 25 rows that were paged by `created_at` presents a page-local order as if it were global — at 25 users this is harmless; at 200 it is misleading.

**Solution.** Build the invite route (`POST /api/admin/users/invite`, service-role, rate-limited, audit-logged, `core.user_manage`-guarded) and the invite dialog. Add password-reset and session-revoke actions on the same route. Add an email column. Either move sorting server-side or label it "sorted within this page".

**Priority: High** — this is the keystone. Until it lands, the module's authorization story is theoretical.

---

### M-16 · Screens with no read path back to their consequences — **Medium**

Settings screens change values that are consumed elsewhere, and none of them show the blast radius:

- Deleting a **grading scheme** that `basic_config.grading_system_id` points at leaves a dangling reference; the confirm dialog says only "Delete scheme?".
- Deleting a **class** warns that "all sections will be affected" but does not say how many students are enrolled in them.
- Deleting a **subject** in use by a subject group, a class-subject mapping or an existing mark row is confirmed with a bare "Delete subject?".
- Changing **pass mark** or the **grading scheme** does not warn that already-processed results were computed under the old values.
- Deleting a **term** does warn about report mismatch — the one place this is done right, and the model for the rest.

**Solution.** A shared `useImpactPreview(entity, id)` returning dependent counts, rendered inside `ConfirmDialog`: *"3 sections · 128 enrolled students · 4 subject mappings reference this class."* Block deletion where a hard reference exists; require `DangerConfirm` (which already implements type-to-confirm + reason) where it is soft.

**Priority: Medium.**

---

## 2. Screen-by-screen deep dive

Findings are `S-n.m`. Cross-cutting items already covered in §1 are referenced, not repeated.

---

### 2.1 Basic Config

**What it is.** 15 settings across Academic / Regional / Default Policies, plus four feature toggles, persisted as one `basic_config` jsonb blob. Skeleton loading, `SaveBar` with `UnsavedDot`, reset, `useUnsavedGuard`, four numeric range validations with blur-touched errors. **This is the best-built form in the module** and the right reference for the others.

**Findings.**

| ID | Finding | Priority |
|---|---|---|
| S-1.1 | Whole-blob last-write-wins (M-3). | Critical |
| S-1.2 | Four toggles have no `role="switch"` / `aria-checked` (A-1). | High |
| S-1.3 | Failed save does not move focus to the first invalid field (A-4). | High |
| S-1.4 | No `PageHeader`, no breadcrumbs — the only screen besides StartUp without them. | Medium |
| S-1.5 | Timezone is a disabled input hard-coded to `Asia/Dhaka (GMT+6)`. Honest, but it is presented as a setting. Either make it real or move it to a read-only "System" row. | Low |
| S-1.6 | **Settings have no explanation of consequence.** "Pass mark" changes how every result is computed; the field has no hint, no "affects: exam processing, marksheets", and no warning that historical results were computed under the old value. | Medium |
| S-1.7 | Toggling **EduSathi AI assistant** off is a product-level kill switch sitting in a row of four undifferentiated toggles with no confirmation and no indication of who it affects. Given EduSathi is the product's headline differentiator, this deserves its own card with scope controls (which roles, which modules) rather than a boolean. | Medium |
| S-1.8 | `grading_system_id` references a scheme that Grading Scheme can delete (M-16). | Medium |
| S-1.9 | 15 fields in three cards with no search and no "changed from default" indicator. At 30+ settings this becomes unnavigable. | Low |
| S-1.10 | `NUMERIC_RULES` covers 4 of 15 keys — deliberate and documented, but `session_start_month` + `week_start_day` + `working_days` + `weekend` are mutually constrained (a Sun–Thu working week with a Sun–Sat weekend is accepted) and nothing checks the combination. | Medium |

**Recommendation.** Keep the structure; add a right-hand **"What this affects"** rail per card; add a per-setting `hint`; group the four toggles into a "Features" card with the EduSathi entry promoted; add search once the count passes ~20.

---

### 2.2 StartUp

**What it is.** Institution identity (name bn/en, EIIN, code, type, founding year, board, MPO status), contact, head-teacher selection, logo upload. Two-column layout with the logo panel and an info callout on the right.

**Findings.**

| ID | Finding | Priority |
|---|---|---|
| S-2.1 | **No validation at all.** EIIN, email, phone, website, founding year all accept anything (M-7). This data prints on every certificate and is submitted to the board. | High |
| S-2.2 | **`useUnsavedGuard` is not called** despite `dirty` being tracked (M-11). | Medium |
| S-2.3 | Raw `<button>`s in the SaveBar instead of `<Button>` (M-10). | Medium |
| S-2.4 | Logo upload: no size/MIME validation, promises "up to 1 MB" (M-5). | High |
| S-2.5 | No `PageHeader`/breadcrumbs. | Medium |
| S-2.6 | **The logo cannot be removed or replaced-with-nothing.** `logo_file_id` uses `coalesce(nullif(…), logo_file_id)`, so once set it can only be swapped, never cleared. | Low |
| S-2.7 | No preview of how the identity renders in a marksheet header — the callout *says* it is used there, but the operator cannot see it. This is the single highest-value addition to this screen. | Medium |
| S-2.8 | `institution_code` and `mpo_status` live in `metadata` jsonb while every sibling field is a column. Merged with `||`, so they can never be unset. Inconsistent and quietly lossy. | Low |
| S-2.9 | Head Teacher panel shows mobile/email from the selected teacher but offers no route to edit them — a dead end. | Low |
| S-2.10 | Duplicate `setF({…})` initialisation block in `useEffect` and `onReset` (lines 35-42 and 69-76) — one is going to drift from the other. | Low |

**Recommendation.** Add zod validation with Bangladesh-specific rules (EIIN = 6 digits, phone = `01[3-9]\d{8}`). Add a **live marksheet-header preview** panel replacing the static info callout. Promote `institution_code`/`mpo_status` to real columns. Add `useUnsavedGuard`.

---

### 2.3 Class Config

**What it is.** Master-detail: a class list on the left, class form + section table on the right. Year-scoped section reads. Real `<table>` for sections with `TableEmpty`.

**Findings.**

| ID | Finding | Priority |
|---|---|---|
| S-3.1 | No pagination or count on the class list; capped at `MAX_OPTIONS`. | Medium |
| S-3.2 | `numeric_level` uniqueness is unvalidated — two classes at level 9 make ordering ambiguous everywhere it is used. | Medium |
| S-3.3 | Section capacity is unvalidated against current enrolment; capacity 20 on a section with 45 enrolled is accepted and the table then reports permanent over-subscription with no warning styling. | Medium |
| S-3.4 | The section form doubles as an edit form but **there is no edit affordance in the table** — the row has only a delete button, and `sf.id` can only be set by code that never runs. Editing a section's capacity or class teacher is impossible through the UI. | **High** — a functional dead end |
| S-3.5 | Class delete confirm says "all sections will be affected" — vague, and it omits enrolled-student counts (M-16). | Medium |
| S-3.6 | Switching the selected class does not reset the in-progress section draft (`sf`), so a half-typed section carries into a different class. | Medium |
| S-3.7 | The class list is a column of `<button>`s, not a listbox; no keyboard roving, no `aria-current` on the selected item. | Medium |
| S-3.8 | "New class" clears the selection but the section panel disappears entirely, with no explanation that sections come after saving. | Low |
| S-3.9 | Shift/stream (morning/day) and room assignment are absent, though `shift` exists as a table in the schema. | Low |

**Recommendation.** Add an edit button per section row (S-3.4 is a real hole). Validate `numeric_level` uniqueness and capacity ≥ enrolled. Reset the section draft on class change. Convert the class list to a proper listbox with roving `tabindex`.

---

### 2.4 Academic Calendar

**What it is.** The most ambitious screen in the module — month grid, range-based holiday marking, working-day override, and a Terms panel. The design reasoning in the header comment ("a range is the unit of work, not a day") is correct and well argued.

**Findings.**

| ID | Finding | Priority |
|---|---|---|
| S-4.1 | **Every RPC it calls is missing from the live database (M-1). The screen does not work.** | **Critical** |
| S-4.2 | The month grid is not a `role="grid"`, has no arrow-key navigation, and each day's accessible name is the bare day number (A-3). | High |
| S-4.3 | `to < from` is prevented by the `min` attribute only; a scripted or pasted value passes to the RPC. | Medium |
| S-4.4 | `weekendDows()` duplicates the server's `basic_config.weekend` mapping client-side — documented as deliberate for paint-only use, but the two will drift when a new weekend option is added. Return the weekend mask from `fn_calendar_range` instead. | Medium |
| S-4.5 | No year view. Planning an academic year through a month-at-a-time viewport means twelve navigations to see the shape of the year. | Medium |
| S-4.6 | No drag-select across cells; a range must be typed into the modal even though the grid is right there. | Medium |
| S-4.7 | No holiday **categories** (government / religious / institutional / exam period / vacation) and no colour coding — every non-working day is the same red. Exam periods and vacations are operationally different things. | Medium |
| S-4.8 | No import of the national holiday calendar. Every school in Bangladesh will re-enter the same ~22 government holidays by hand, every year. This is the highest-value feature on this screen. | High |
| S-4.9 | Term date ranges are not validated against the academic year, are not checked for overlap, and `is_current` exclusivity is enforced only server-side with no UI signal about which term will be displaced. | Medium |
| S-4.10 | Terms have no link to what consumes them (marksheets, fee schedules) despite the subtitle claiming the relationship. | Low |
| S-4.11 | Deleting a calendar mark on a date with recorded attendance has no impact preview. | Medium |

**Recommendation.** Fix S-4.1 first — nothing else on this screen matters until the functions exist. Then: year view, drag-select, holiday categories with distinct tones, and a **"Import Bangladesh government holidays"** action seeded per year.

---

### 2.5 Signature

**What it is.** Four hard-coded roles, each a name field and a PNG upload, rendered as a 2×2 card grid.

**Findings.**

| ID | Finding | Priority |
|---|---|---|
| S-5.1 | **Save-on-blur with no dirty tracking, no confirm, no undo (A-5).** Tabbing through the form writes four times. | High |
| S-5.2 | **No delete.** `useDeleteSignature` exists in `hooks.ts` and is never imported. A wrong signature image is permanent. | High |
| S-5.3 | Upload accepts any file of any size (M-5); the caption promises "up to 500KB". | High |
| S-5.4 | **Roles are hard-coded to four.** A madrasha has a Principal and a Superintendent; a college has a Vice-Principal. `signature.role_label` is a free-text column — the constraint is entirely in the UI. | Medium |
| S-5.5 | No preview of the signature in its printed context, no cropping, no transparency check, no aspect-ratio guidance beyond `h-16 w-32`. A signature photographed on white paper prints as a grey box. | Medium |
| S-5.6 | Signed URLs are fetched serially in a `useEffect` on every mount (M-13). | Medium |
| S-5.7 | No "who approved this signature" or validity window — a signature is a legal artefact on a certificate and carries no provenance. | Medium |
| S-5.8 | `byRole()` is called inside a `useEffect` with `eslint-disable-next-line react-hooks/exhaustive-deps` — a stale-closure hazard suppressed rather than resolved. | Low |
| S-5.9 | **`signature = 0` in production.** Every certificate printed to date is unsigned, and nothing in the product says so. | High |

**Recommendation.** Rebuild as an explicit form: dirty tracking, explicit save, delete, replace, and a **live preview on a real certificate template**. Make roles data-driven (seed the four, allow adding). Add background-removal guidance or automatic white-to-transparent conversion. Surface "0 signatures configured" as a warning on the Settings hub and on the certificate screens.

---

### 2.6 Subject List

**What it is.** A seven-column table with search, type filter, and a create/edit modal. Good table semantics with a documented `<th scope>` fix.

**Findings.**

| ID | Finding | Priority |
|---|---|---|
| S-6.1 | `pass_marks > full_marks` accepted; `min_class_level > max_class_level` accepted (M-7). | High |
| S-6.2 | The "Active" toggle in the modal has **no accessible name at all** (A-2). | High |
| S-6.3 | Search and filter are raw `<input>`/`<select>`, not `DataToolbar`; no URL state, no pagination, no export (M-8). | High |
| S-6.4 | Filtering is client-side over a `MAX_OPTIONS`-capped fetch — beyond the cap, filter results are simply wrong. | Medium |
| S-6.5 | Subject code uniqueness is unvalidated; two subjects can share `BAN-101`. | Medium |
| S-6.6 | Delete has no impact preview — a subject with marks recorded against it deletes with a bare confirm (M-16). | High |
| S-6.7 | No bulk operations. Onboarding a school means creating ~15 subjects one modal at a time; there is no CSV import even though `src/features/admin/*/logic/importSpec.ts` exists as a pattern for Student, Teacher and Exam. | Medium |
| S-6.8 | The row shows the name twice — once by locale and once as "bn — en" underneath. Redundant at every row. | Low |
| S-6.9 | No subject **type** beyond compulsory/optional: no 4th-subject, no practical/theory split, no credit hours — all of which Bangladeshi marksheets need. | Medium |
| S-6.10 | No mapping from subject → classes actually teaching it (`class_subject` exists in the schema and is unsurfaced). | Medium |

**Recommendation.** Add cross-field validation, `DataToolbar` + server pagination, CSV import reusing the existing `importSpec` pattern, and a "used by" column. Add theory/practical marks split — it is required for the marksheet and is currently unrepresentable.

---

### 2.7 Subject Group

**What it is.** The thinnest screen in the module: a card grid of groups with a name + subject-checkbox modal.

**Findings.**

| ID | Finding | Priority |
|---|---|---|
| S-7.1 | A group with **zero subjects** saves successfully and then renders "No subjects" — a valid-looking record that does nothing. | Medium |
| S-7.2 | Duplicate group names accepted. | Low |
| S-7.3 | Raw `<input type="checkbox">` instead of shared `Checkbox` (A-9). | Medium |
| S-7.4 | The subject picker is an unsearchable `max-h-56` scroll list. At 40 subjects this is unusable. | Medium |
| S-7.5 | **No link to classes.** A "Science" group means nothing until it is attached to classes 9–10; that relationship is absent from the UI entirely. | High |
| S-7.6 | No compulsory-vs-elective distinction *within* a group — the core reason group configuration exists in a Bangladeshi school (a student picks 1 of 3 optional subjects). Currently unrepresentable. | High |
| S-7.7 | No count of students currently assigned to the group; delete has no impact preview. | Medium |
| S-7.8 | No `PageHeader` count/search/export; a card grid with no ordering control. | Low |
| S-7.9 | Group name is single-language (`name` only), unlike every sibling entity which carries `name_bn`/`name_en`. | Medium |

**Recommendation.** This screen needs the most conceptual work of the eleven. Rebuild around the real domain object: **a group is (name, applicable classes, compulsory subjects, elective pools with pick-N rules)**. Add `name_bn`. Add a searchable transfer-list picker. Block empty groups.

---

### 2.8 Grading Scheme

**What it is.** Scheme selector, read-only band table, and an editor modal with live `validateGradeScale` feedback. The validation reasoning (a scheme with a gap or overlap silently mis-grades a cohort) is exactly right and is the module's best example of validation done well.

**Findings.**

| ID | Finding | Priority |
|---|---|---|
| S-8.1 | **Every row's pencil opens the same whole-scheme modal.** The affordance says "edit this grade"; the behaviour is "edit all grades". | Medium |
| S-8.2 | Deleting the scheme referenced by `basic_config.grading_system_id`, or by a `class.grade_scheme_id`, is confirmed with a bare "Delete scheme?" (M-16). | High |
| S-8.3 | Setting `is_default` gives no indication which scheme is being displaced. | Medium |
| S-8.4 | **No preview.** "What grade does 67 produce under this scheme" cannot be asked. A mark-to-grade tester next to the table is a five-line component and removes the main reason to distrust the screen. | Medium |
| S-8.5 | No warning that editing a scheme **already used to process results** makes historical marksheets inconsistent with the current scheme. This is the highest-consequence unguarded action in the module. | **High** |
| S-8.6 | The `is_default` checkbox is a raw `<input>` (A-9); the scheme selector is a raw `<select>` (M-10). | Medium |
| S-8.7 | GPA is unvalidated: negative values, or a GPA above the scheme maximum, are accepted. | Medium |
| S-8.8 | `REMARKS` is keyed on the literal letters `A+ / A / A- / B / C / D / F`. A custom scheme using different letters silently renders "—" in the Remark column. | Low |
| S-8.9 | No support for subject-level or class-level scheme overrides, though `class.grade_scheme_id` exists in the schema. | Medium |
| S-8.10 | No versioning. There is no way to say "this scheme applied to the 2025 session and this one to 2026" — required for reprinting an old marksheet correctly. | Medium |

**Recommendation.** Add a mark→grade preview. Add an "in use by N classes, M processed results" banner in the editor with a hard block on editing a scheme with processed results (copy-on-write into a new version instead). Fix the per-row pencil to edit one band inline.

---

### 2.9 Users & Roles

**What it is.** The most complete screen in the module: full data contract, role editor, suspend/reactivate, MFA reset with `DangerConfirm` (type-to-confirm + mandatory reason), last-sign-in column, CSV export, `LiveRegion`.

**Findings.**

| ID | Finding | Priority |
|---|---|---|
| S-9.1 | **No invite.** The keystone gap (M-15) — `profile = 1` in production. | **High** |
| S-9.2 | No password reset, no force-change-at-next-login, no session revoke. Suspending a user does not terminate their live session. | High |
| S-9.3 | No email column; identity is `full_name` + `phone` only. | Medium |
| S-9.4 | Client-side sort over a server page presents a page-local ordering as global (M-15). | Medium |
| S-9.5 | No bulk operations (assign role to N users, suspend N users). | Low |
| S-9.6 | The `invited` status is offered as a filter value but no code path can ever produce it. | Low |
| S-9.7 | The role editor lists role `name` + `code` with **no description of what each role can do** — the permission matrix is one click away and not linked from the dialog. | Medium |
| S-9.8 | A user with no roles is warned about at edit time but is not flagged in the list. | Low |
| S-9.9 | No per-user activity view; the audit log cannot be filtered by actor (M-14), so "what has this user done" is unanswerable from the screen that manages them. | Medium |
| S-9.10 | Suspension has no reason field and no scheduled reactivation, unlike MFA reset which requires a reason. Inconsistent severity treatment for two comparable actions. | Medium |

**Recommendation.** Ship the invite route. Add reset-password and revoke-sessions to the same route. Add an email column, a role-description popover, and a "View activity" action deep-linking to a pre-filtered audit log.

---

### 2.10 Permission Matrix

**What it is.** A read-only role × capability grid grouped by module, with `sr-only` per-cell state text and CSV export. The read-only decision is well argued in the header comment and is correct for this release.

**Findings.**

| ID | Finding | Priority |
|---|---|---|
| S-10.1 | **`fn_permission_matrix` is unguarded (M-2).** | Critical |
| S-10.2 | No sticky first column on a table that scrolls horizontally (A-7). | High |
| S-10.3 | No search or module filter across 29 permissions × 4 roles; at 20 custom roles × 60 permissions it becomes unreadable. | Medium |
| S-10.4 | No "who holds this role" count per column — the matrix says what a role *can* do, never how many people have it. | Medium |
| S-10.5 | Read-only with no path forward. The comment says "custom roles will be" editable; the screen shows no roadmap signal to the user, only "not editable here". | Medium |
| S-10.6 | No diff or history. Role permissions are audited (`role_permission` is in `AUDIT_ENTITIES`) but this screen does not link to that history. | Low |
| S-10.7 | `MODULE_LABEL` is hard-coded in the component; a new module in the seed renders as a raw code. It falls back safely (a documented improvement over the audit log's earlier bug) but the labels belong in the database. | Low |
| S-10.8 | Export is a raw `<button className={buttonClass(...)}>` rather than `<Button>` (M-10). | Low |

**Recommendation.** Guard the RPC. Sticky first column, permission search, per-role user counts, and a link to the role's audit history. Custom roles are the natural next release: `is_system` already distinguishes seeded roles, so an editable grid restricted to non-system roles is safe.

---

### 2.11 Audit Log

**What it is.** Server-paged, URL-persisted, record-ID search, entity/action filters, page-scoped export, detail modal. Correctly reasoned throughout (see M-14 for the full analysis).

**Findings.**

| ID | Finding | Priority |
|---|---|---|
| S-11.1 | No date-range filter (M-14). | High |
| S-11.2 | No "changed by" filter, despite the profile join already existing (M-14). | High |
| S-11.3 | Raw JSON before/after instead of a field diff (M-14). | Medium |
| S-11.4 | PII shown verbatim with no redaction and no log of who read it (M-14). | High |
| S-11.5 | `<pre>` blocks are unlabelled, un-focusable scroll regions at 12 px (A-6). | Medium |
| S-11.6 | No IP address / user agent / session, though `access_log` exists in the schema and captures some of it — two logs, one screen, no join. | Medium |
| S-11.7 | Breadcrumb root reads "সেটিংস / Settings" while the other eight read "কোর সেটিংস / Core Settings" (M-10). | Low |
| S-11.8 | No retention or archive policy (M-14). | Medium |
| S-11.9 | No link from a record's audit row to that record's own screen — a `student` UPDATE cannot be opened. | Medium |
| S-11.10 | No `severity` surfacing despite `fn_admin_reset_mfa` writing `severity: 'high'`. | Medium |

**Recommendation.** Date range + actor filter + field diff + severity chip + deep link to the record. Redaction with a reveal that self-logs. Merge `access_log` (sign-ins, MFA resets) into the same timeline as a "Security" tab — an auditor wants one chronology, not two screens.

---

## 3. Recommendations

### 3.1 Proposed information architecture

Current: eleven flat tabs, no hub, one permission.

Proposed:

```
/admin/core                        Settings hub — grouped cards, status chips, setup checklist, search
│
├── Institution
│   ├── /identity          (StartUp, renamed)          core.settings
│   ├── /academic          (Basic Config → Academic)   core.settings
│   ├── /regional          (Basic Config → Regional)   core.settings
│   ├── /classes           (Class Config)              core.settings
│   ├── /calendar          (Academic Calendar)         core.settings
│   └── /signatures        (Signature)                 core.settings
│
├── Academic
│   ├── /subjects          (Subject List)              core.settings
│   ├── /subject-groups    (Subject Group)             core.settings
│   ├── /grading           (Grading Scheme)            core.settings
│   └── /policies          (Basic Config → Policies)   core.settings
│
├── Access & Governance
│   ├── /users             (Users & Roles)             core.user_manage
│   ├── /roles             (Permission Matrix)         core.user_manage
│   └── /audit             (Audit Log)                 audit.read
│
└── Platform  [NEW]
    ├── /features          Feature flags incl. EduSathi scope         core.settings
    ├── /integrations      SMS gateway, payment gateway, email        core.settings
    ├── /notifications     Which events notify whom, on which channel core.settings
    ├── /security          Password policy, MFA enforcement, sessions core.settings
    └── /data              Backup, export, retention, import history  core.settings
```

Rationale: Basic Config's three cards are three unrelated concerns sharing one blob and one save button — Academic belongs with Grading, Regional belongs with Identity. Splitting them also removes the whole-blob concurrency problem by construction (M-3), because each screen then owns a distinct setting key.

### 3.2 Screens to add

| Screen | Why | Priority |
|---|---|---|
| **Settings hub** (`/admin/core`) | The module has no front door (M-6). | High |
| **Integrations** | SMS gateway credentials, bKash/Nagad keys, SMTP. Today these are environment variables an administrator cannot see or rotate. | High |
| **Security policy** | Password policy, MFA enforcement per role, session timeout, IP allow-list. `auth_leaked_password_protection` is **disabled** on the live project and no screen exposes it. | High |
| **Notification rules** | Which events (absence, result published, fee due) notify which audience on which channel. Currently a single global "Parent SMS notifications" boolean. | Medium |
| **Feature flags / EduSathi scope** | Promote the AI assistant out of a four-toggle row into a real configuration surface: enabled roles, enabled modules, usage quota, data-sharing consent. It is the product's headline differentiator and is currently one checkbox. | Medium |
| **Data & backup** | Export the institution's data, view import history, configure audit retention. A procurement requirement for public institutions. | Medium |
| **Academic year management** | `AcademicYearProvider` exists and archived years are read-only, but there is no screen to create, close or roll over a year. | High |
| **Onboarding wizard** | A first-run guided setup covering the seven configuration steps in order. | Medium |

### 3.3 Screens to remove or merge

| Action | Rationale |
|---|---|
| **Merge** Subject Group into Subject List as a second tab | Two screens for one concept; the group screen has no independent identity (S-7.5). |
| **Split** Basic Config into Academic / Regional / Policies | Three unrelated concerns in one blob with one save button (§3.1, M-3). |
| **Merge** Permission Matrix into Users & Roles as a tab | They already cross-link to each other in both directions; they are one task. |
| **Do not remove** any screen outright | All eleven answer a real question. The problem is grouping, not existence. |

### 3.4 Visual design and colour

The token set is sound — semantic naming, light/dark parity, a tested contrast floor, and the `font-size-adjust` Bangla/Latin parity fix with a `@supports` fallback. Recommendations are about *use*, not replacement:

1. **Give Settings a distinct surface temperature.** Settings is a configuration context, not an operational one. A subtly cooler `sunken` and a neutral accent for non-destructive controls signals "you are changing how the system behaves" without a second palette.
2. **Add a `--color-caution` tier between `warning` and `danger`.** The module currently has one alarming colour, so "this affects processed results" and "this deletes a record" look identical.
3. **Encode setting state, not just value.** A "modified from default" dot and a "used by N screens" chip carry more information than any colour change.
4. **Reserve `primary-subtle` for selection only.** It currently marks the selected class (Class Config), an info callout (StartUp), a passive info chip (Grading) and an avatar background (Subject Group) — four meanings, one colour.
5. **One severity ramp for destructive actions**: text link (low) → outline button (medium) → `DangerConfirm` with type-to-confirm and reason (high). Map every delete in the module onto it (currently five ad-hoc patterns).

### 3.5 Component hierarchy to introduce

| Component | Replaces | Screens affected |
|---|---|---|
| `<Switch>` — `role="switch"`, `aria-checked`, label association | 5 ad-hoc toggle buttons | Basic Config, Subject |
| `<SettingRow label hint affects>` | bare `<Field>` for configuration values | Basic Config, and the split screens |
| `<ImpactPreview entity id>` | bare confirm descriptions | Class, Subject, Group, Grading, Calendar, Signature |
| `<NoAccessState>` | `EmptyState` used for authorization failures | all 11 |
| `<SettingsHubCard>` | — (new) | hub |
| `<JsonDiff before after>` | two `<pre>` blocks | Audit Log |
| `<AssetUpload maxSize accept onCrop>` | two bespoke upload blocks | StartUp, Signature |
| `<EntityPicker searchable>` | the `max-h-56` checkbox list | Subject Group, and role assignment |

### 3.6 Interaction patterns to adopt

- **Autosave with explicit undo** for low-risk single values; **explicit save with a dirty guard** for multi-field forms. Pick per screen and never mix within one — Signature currently autosaves silently, which is the worst of both.
- **Optimistic UI with rollback** for toggles, so a switch responds instantly and reverts visibly on failure.
- **Impact preview before every destructive action**, sized to consequence.
- **Deep-linkable settings**: `/admin/core/academic#pass_mark` scrolls to and highlights the field, so support can send a link instead of directions.
- **Change history per setting**: a small "last changed by X on Y" line under high-consequence values, sourced from the audit log that already records them.

---

## 4. Micro execution TODO

Sequenced. Each phase is independently shippable. `[FE]` frontend, `[BE]` backend/RPC, `[DB]` schema, `[QA]` test, `[DS]` design system.

---

### Phase 0 — Stop the bleeding (Critical) · target 3 days

**0.1 Restore the Academic Calendar (M-1, S-4.1)**
- [ ] `[DB]` Verify absence: `select to_regprocedure('public.fn_calendar_range(date,date)')` for all six functions.
- [ ] `[DB]` Re-apply `20260801096000_academic_calendar.sql` to the live project.
- [ ] `[DB]` Verify each function now resolves; confirm `require_permission('core.settings')` guards the three write functions.
- [ ] `[BE]` Seed `academic_calendar` weekend rows for the current academic year.
- [ ] `[QA]` Add `tests/rpcContract.test.ts`: scan `src/**` for `.rpc("fn_…")`, assert each exists in `database.types.ts` **and** in the live schema.
- [ ] `[QA]` Add `supabase db diff --linked` to CI; fail the build on drift.
- [ ] `[FE]` Manually verify: mark a range, clear a mark, create a term, set `is_current`, delete a term.
- [ ] `[QA]` Verify `useDayStatus` now resolves on the attendance screens.

**0.2 Guard `fn_permission_matrix` (M-2, S-10.1)**
- [ ] `[DB]` Add `perform private.require_permission('core.user_manage');`.
- [ ] `[QA]` pgTAP: assert a `teacher`-role JWT gets `permission denied`; assert `institution_admin` succeeds.
- [ ] `[QA]` pgTAP: assert **every** `prosecdef` function in `public` calls `require_permission` or is on the explicit allow-list.
- [ ] `[FE]` Render `<NoAccessState>` rather than an error toast when the RPC is denied.

**0.3 Fix lost-update on settings (M-3, S-1.1)**
- [ ] `[DB]` `fn_save_setting(p_key, p_scope, p_value, p_expected_updated_at default null)`; raise `setting_conflict` on mismatch.
- [ ] `[DB]` Merge semantics: `value = coalesce(value,'{}') || p_value` so partial writes are safe.
- [ ] `[BE]` `fetchSetting` returns `{ value, updated_at }`.
- [ ] `[FE]` Send `updated_at` and only the changed keys.
- [ ] `[FE]` Conflict dialog with "Reload" / "Overwrite" — never a silent overwrite.
- [ ] `[QA]` Unit test: two concurrent saves of different keys both persist; two of the same key raise the conflict.

**0.4 Constrain uploads (M-5, S-2.4, S-5.3)**
- [ ] `[DB]` `update storage.buckets set file_size_limit = 1048576, allowed_mime_types = ARRAY['image/png','image/svg+xml','image/jpeg'] where id = 'institution-assets';`
- [ ] `[BE]` Validate `file.size` / `file.type` in `uploadInstitutionAsset`; throw a typed error.
- [ ] `[BE]` Slugify the filename in the object path.
- [ ] `[FE]` Downscale via the existing `imageResize.ts` before upload.
- [ ] `[FE]` Show the limit as validation feedback, not caption text.
- [ ] `[QA]` Test: oversize file rejected client-side; wrong MIME rejected; bucket rejects a forged direct upload.

**Phase 0 exit criteria:** Calendar functional end-to-end · matrix RPC denied to non-`core.user_manage` · concurrent settings saves do not lose data · oversize upload rejected at both layers · CI fails on schema drift.

---

### Phase 1 — Access control and authorization surface (High) · target 1 week

**1.1 Per-tab permissions (M-4, H-1)**
- [ ] `[FE]` Add `permission?: string` to `AdminModuleTab` in `adminNav.ts`.
- [ ] `[FE]` Set `core.user_manage` on user-list + permissions, `audit.read` on audit-log, `core.settings` on the rest.
- [ ] `[FE]` Filter `ModuleTabs` on `useMyPermissions()`, fail-open on `undefined`/`[]` to match `canSeeModule`.
- [ ] `[DS]` Build `<NoAccessState>` (lock icon, explanation, "request access" mailto).
- [ ] `[FE]` Render it on all 11 screens when the permission is absent.
- [ ] `[QA]` Extend `adminNav.test.ts`: accountant sees 8 tabs, admin sees 11, empty permissions sees 11.

**1.2 User invite and account operations (M-15, S-9.1, S-9.2)**
- [ ] `[BE]` `POST /api/admin/users/invite` — service-role, `core.user_manage`-guarded, rate-limited via the existing `request_log`, audit-logged.
- [ ] `[BE]` `POST /api/admin/users/reset-password`, `POST /api/admin/users/revoke-sessions`.
- [ ] `[DB]` `profile.status = 'invited'` + `invited_at`, `invited_by`.
- [ ] `[FE]` Invite dialog: name, phone, email, roles, optional welcome message.
- [ ] `[FE]` Add "Send password reset" and "Revoke sessions" to `RowActions`.
- [ ] `[FE]` Show `invited` as a real state with a "Resend invite" action.
- [ ] `[FE]` Add an email column.
- [ ] `[FE]` Suspension: add an optional reason, and revoke live sessions on suspend.
- [ ] `[QA]` Test: invite → invited status → sign-in → active; rate limit trips at N; a non-`core.user_manage` caller gets 403.

**1.3 Audit log investigation tools (M-14, S-11.1–S-11.4)**
- [ ] `[BE]` Add `from` / `to` / `changedBy` parameters to `fetchAuditLog`.
- [ ] `[FE]` Date-range picker + "Changed by" select in `DataToolbar`.
- [ ] `[DS]` `<JsonDiff>`: changed keys only, `key · before → after`, unchanged collapsed.
- [ ] `[FE]` Severity chip from `after->>'severity'`.
- [ ] `[FE]` Deep link from an audit row to the record's own screen.
- [ ] `[BE]` Redact a configured PII key list; "reveal" writes an `access_log` entry.
- [ ] `[FE]` Add "View activity" on the user list, deep-linking to a pre-filtered audit log.
- [ ] `[DB]` Retention policy + archive job for `audit_log`.
- [ ] `[QA]` Test: date filter bounds correct; redaction applied; reveal is logged.

---

### Phase 2 — Validation and data integrity (High) · target 1 week

- [ ] `[FE]` Create `logic/schemas.ts` per screen; wire through the existing `useZodForm`.
- [ ] `[DS]` Extract `BasicConfigScreen`'s `bind()`/`touched` pattern into a shared `useFieldErrors` hook.
- [ ] `[FE]` **StartUp** — EIIN 6 digits, phone `01[3-9]\d{8}`, email, URL, founding year 1800–current.
- [ ] `[FE]` **Subject** — `pass_marks <= full_marks`, marks 0–1000, `min_class_level <= max_class_level`, unique code.
- [ ] `[FE]` **Class** — unique `numeric_level`, capacity ≥ current enrolled, capacity ≥ 1.
- [ ] `[FE]` **Subject Group** — non-empty subject list, unique name, add `name_bn`.
- [ ] `[FE]` **Calendar** — `to >= from`, range ≤ 366 days, term inside the academic year, no term overlap.
- [ ] `[FE]` **Grading** — GPA ≥ 0 and ≤ scheme max; keep `validateGradeScale`.
- [ ] `[FE]` **Basic Config** — cross-field working-days/weekend consistency.
- [ ] `[BE]` Mirror every rule in the corresponding RPC (client is UX, database is the control).
- [ ] `[FE]` Focus the first invalid field on failed save (A-4), on all form screens.
- [ ] `[FE]` Add `useUnsavedGuard` to StartUp (M-11).
- [ ] `[DS]` `<ImpactPreview>`; wire into Class, Subject, Subject Group, Grading, Calendar, Signature deletes.
- [ ] `[BE]` `fn_entity_impact(p_entity text, p_id uuid)` returning dependent counts.
- [ ] `[FE]` Block deletion on hard references; require `DangerConfirm` on soft ones.
- [ ] `[FE]` Block editing a grading scheme with processed results; offer copy-to-new-version (S-8.5).
- [ ] `[QA]` One validation test per screen: invalid input blocked, error rendered, save not called.

---

### Phase 3 — Accessibility (High) · target 4 days

- [ ] `[DS]` `<Switch>` with `role="switch"`, `aria-checked`, label association, 44 px hit target.
- [ ] `[FE]` Replace all five ad-hoc toggles (A-1, A-2).
- [ ] `[FE]` Calendar month → `role="grid"` with `role="row"`/`role="gridcell"`, roving `tabindex`, arrow/Home/End/PageUp/PageDown, using the existing `useGridNavigation` (A-3).
- [ ] `[FE]` Full `aria-label` per day: date + weekday + working/holiday + label.
- [ ] `[FE]` `metadata` export on all 11 `page.tsx` files (A-8).
- [ ] `[FE]` Sticky first column on the permission matrix (A-7).
- [ ] `[FE]` Audit-log `<pre>` → labelled, `tabindex="0"` scroll regions at `text-meta` (A-6).
- [ ] `[FE]` Replace raw checkboxes with shared `Checkbox` (A-9).
- [ ] `[FE]` Signature: dirty tracking + explicit save, removing on-blur writes (A-5).
- [ ] `[QA]` `vitest-axe` on all 11 screens, zero violations.
- [ ] `[QA]` Keyboard-only walkthrough of each screen; document the tab order.
- [ ] `[QA]` NVDA + VoiceOver pass on Calendar, Permission Matrix and Users.
- [ ] `[QA]` Verify all Bangla and English strings at 200 % zoom and 320 px width.

---

### Phase 4 — Interaction contract and IA (High) · target 1.5 weeks

**4.1 Settings hub (M-6)**
- [ ] `[FE]` `src/app/(admin)/admin/core/page.tsx`.
- [ ] `[DS]` `<SettingsHubCard>` with icon, title, description, status chip.
- [ ] `[BE]` `fn_settings_status()` returning per-area counts and completeness.
- [ ] `[FE]` Three grouped sections; warning chips for 0 signatures / empty calendar / 1 user.
- [ ] `[FE]` Setup checklist with percentage complete.
- [ ] `[FE]` Settings search across screen names and individual setting labels; deep-link with hash-highlight.

**4.2 Data contract retrofit (M-8)**
- [ ] `[FE]` `useDataScreen` + `DataToolbar` on Subject, Subject Group, Grading, Class, Signature.
- [ ] `[BE]` `count: "exact"` + server-side range on those list queries.
- [ ] `[FE]` `Pagination` + `LiveRegion` where counts can exceed a page.
- [ ] `[FE]` CSV export on Subject, Subject Group, Grading, Class.
- [ ] `[FE]` "Showing N of M" on every capped list.
- [ ] `[FE]` Move Subject search/filter server-side (S-6.4).

**4.3 Screen splits and merges (§3.1, §3.3)**
- [ ] `[FE]` Split Basic Config → `/academic`, `/regional`, `/policies`, each with its own setting key.
- [ ] `[DB]` Migrate `basic_config` into three keys, keeping a read-compat view for one release.
- [ ] `[FE]` Merge Subject Group into Subject List as a tab.
- [ ] `[FE]` Merge Permission Matrix into Users & Roles as a tab.
- [ ] `[FE]` Rename StartUp → "Institution Identity".
- [ ] `[FE]` Update `adminNav.ts` groups, all breadcrumbs, and the command palette.
- [ ] `[FE]` Add redirects from the old routes.

---

### Phase 5 — Screen-specific feature work (Medium) · target 2 weeks

**Class Config**
- [ ] `[FE]` Edit button per section row (S-3.4 — closes a functional dead end).
- [ ] `[FE]` Reset the section draft when the selected class changes.
- [ ] `[FE]` Class list → listbox with roving `tabindex` and `aria-current`.
- [ ] `[FE]` Show enrolled/capacity as a ratio with over-capacity warning styling.
- [ ] `[FE]` Shift and room assignment.

**Calendar**
- [ ] `[FE]` Year view (12-month heatmap).
- [ ] `[FE]` Drag-select across cells to open the range editor pre-filled.
- [ ] `[DB]` `academic_calendar.category` (government / religious / institutional / exam / vacation).
- [ ] `[FE]` Distinct tone per category + legend.
- [ ] `[BE]` `fn_import_national_holidays(p_year int)` seeded with the Bangladesh government calendar (S-4.8).
- [ ] `[FE]` "Import government holidays" action with a preview-before-apply step.
- [ ] `[FE]` Return the weekend mask from `fn_calendar_range`; delete `weekendDows()` (S-4.4).

**Signature**
- [ ] `[FE]` Dirty tracking + explicit save + delete + replace.
- [ ] `[DB]` Data-driven roles; seed the current four.
- [ ] `[FE]` Add/remove signature roles.
- [ ] `[FE]` Live preview on a real certificate template.
- [ ] `[FE]` Crop tool + transparency guidance / auto white-removal.
- [ ] `[BE]` Batch signed-URL fetch (`Promise.all`, cached by file id).
- [ ] `[DB]` `approved_by`, `valid_from`, `valid_to` on `signature`.

**Subject & Groups**
- [ ] `[FE]` CSV import reusing the existing `importSpec` pattern.
- [ ] `[DB]` Theory/practical marks split; credit hours; 4th-subject flag.
- [ ] `[FE]` "Taught in N classes" column from `class_subject`.
- [ ] `[FE]` Group → applicable classes relationship (S-7.5).
- [ ] `[FE]` Elective pools with pick-N rules (S-7.6).
- [ ] `[DS]` `<EntityPicker>` searchable transfer list.

**Grading**
- [ ] `[FE]` Mark → grade preview tester.
- [ ] `[FE]` Per-row inline band editing; stop the pencil opening the whole modal.
- [ ] `[FE]` "In use by N classes, M processed results" banner.
- [ ] `[DB]` Scheme versioning keyed to academic year (S-8.10).
- [ ] `[FE]` Class-level scheme override surface for `class.grade_scheme_id`.
- [ ] `[FE]` Editable remark per band; drop the hard-coded `REMARKS` map.

**Basic Config / Policies**
- [ ] `[FE]` "What this affects" rail per card.
- [ ] `[FE]` Per-setting hint text.
- [ ] `[FE]` "Modified from default" indicator.
- [ ] `[FE]` "Last changed by X on Y" from the audit log.
- [ ] `[FE]` Promote EduSathi from a toggle to a scoped feature card (S-1.7).

---

### Phase 6 — New screens (Medium) · target 2 weeks

- [ ] `[FE][BE]` **Integrations** — SMS gateway, payment gateway, SMTP; masked credential display, test-connection action, rotation.
- [ ] `[FE][BE]` **Security policy** — password policy, MFA enforcement per role, session timeout; **enable `auth_leaked_password_protection`**.
- [ ] `[FE][BE]` **Notification rules** — event × audience × channel matrix.
- [ ] `[FE][BE]` **Academic year management** — create, close, roll over; archived-year read-only enforcement.
- [ ] `[FE][BE]` **Data & backup** — full institution export, import history, audit retention config.
- [ ] `[FE]` **Onboarding wizard** — seven-step guided first-run setup.

---

### Phase 7 — Design-system normalisation (Medium) · target 4 days

- [ ] `[FE]` `PageHeader` + breadcrumbs on Basic Config and StartUp.
- [ ] `[FE]` `<Button>` everywhere; delete the two raw SaveBar buttons in StartUp.
- [ ] `[FE]` Replace `text-xs|sm|base|lg` with named scale tokens across all 11 screens.
- [ ] `[DS]` ESLint rule banning raw font-size utilities in `src/features/**`.
- [ ] `[FE]` One breadcrumb root label across the module.
- [ ] `[DS]` One delete-severity ramp; apply to all destructive actions.
- [ ] `[DS]` One empty-state wrapper convention.
- [ ] `[DS]` Add `--color-caution`; restrict `primary-subtle` to selection.
- [ ] `[DS]` Document the Settings surface treatment in `docs/design-system.md`.
- [ ] `[FE]` 320 / 768 / 1024 / 1440 px pass on all 11 screens; fix horizontal overflow.
- [ ] `[FE]` Mobile: convert the tab strip to a scrollable chip row or a select.
- [ ] `[FE]` Mobile: `SaveBar` sticky-bottom with safe-area inset.
- [ ] `[FE]` Mobile: card-per-row fallback for the seven-column subject table.

---

### Phase 8 — Performance (Medium) · target 3 days

- [ ] `[FE]` `staleTime: 5 * 60_000` on institution, classes, subjects, groups, schemes, signatures, settings.
- [ ] `[BE]` Batch signature signed URLs; cache by file id.
- [ ] `[BE]` Server-side pagination on all capped lists.
- [ ] `[BE]` Review `fetchClassSections`'s nested count aggregate; consider a view.
- [ ] `[FE]` Prefetch the Settings hub's status query on rail hover.
- [ ] `[FE]` Virtualise the permission matrix beyond 20 roles or 60 permissions.
- [ ] `[QA]` Lighthouse ≥ 90 on the five heaviest screens.
- [ ] `[QA]` Seed 500 subjects / 200 users / 100k audit rows and re-measure.

---

### Phase 9 — Testing and production readiness

**9.1 Test checklist (per screen — 11 × 4)**
- [ ] Renders with data; renders loading; renders empty; renders error.
- [ ] Create → success toast → list updates.
- [ ] Edit → save → persisted value re-read.
- [ ] Invalid input → blocked, field error rendered, mutation not called.
- [ ] Delete → confirm → impact preview → removed.
- [ ] Permission denied → `<NoAccessState>`, not an empty table.
- [ ] Bangla and English both render without layout shift.
- [ ] `vitest-axe`: zero violations.

**9.2 Security checklist**
- [ ] Every Settings RPC calls `require_permission` (pgTAP assertion over `pg_proc`).
- [ ] pgTAP: `core.settings`, `core.user_manage`, `audit.read` each denied to the wrong role.
- [ ] Storage bucket limits enforced; forged direct upload rejected.
- [ ] Audit PII redaction verified; reveal is itself logged.
- [ ] Rate limits on invite / password reset / MFA reset.
- [ ] Advisors re-run: `auth_leaked_password_protection` enabled; `SECURITY DEFINER` warnings triaged and each function either guarded or allow-listed with a comment.
- [ ] Signed URLs confirmed not to pass through the Next image optimizer (already correct — keep the two `eslint-disable` comments and their rationale).

**9.3 Accessibility checklist**
- [ ] All 11 screens: axe clean, keyboard-only complete, focus visible throughout.
- [ ] Every interactive control has an accessible name.
- [ ] Every toggle exposes `role` and state.
- [ ] Calendar navigable by arrow keys with meaningful day labels.
- [ ] 200 % zoom, 320 px width, no horizontal scroll on the page body.
- [ ] Contrast verified in light and dark (extend `contrast.test.ts` to the Settings palette).
- [ ] Unique `<title>` per screen.
- [ ] Screen-reader pass on the three most complex screens.

**9.4 Design-QA checklist**
- [ ] Named type scale only; no raw font-size utilities.
- [ ] `PageHeader` + breadcrumbs on all 11.
- [ ] One spacing rhythm (`gap-5` page, `gap-4` field, `gap-3` inline).
- [ ] One delete pattern per severity tier.
- [ ] One empty-state convention.
- [ ] Light and dark parity screenshot per screen.
- [ ] Bangla and English screenshot per screen at 1440 and 375 px.

**9.5 Code-review checklist**
- [ ] No new `.rpc()` call without a contract-test entry.
- [ ] No new `SECURITY DEFINER` function without `require_permission` or an allow-list entry.
- [ ] No new write path without an audit trigger.
- [ ] No new form without a zod schema and a dirty guard.
- [ ] No new list without count, pagination and export.
- [ ] No new destructive action without an impact preview.
- [ ] No new toggle that is not `<Switch>`.
- [ ] No new hard-coded label that belongs in the database.
- [ ] `graphify update .` run after the change.

**9.6 Production-readiness gate**
- [ ] All Phase 0 items closed and verified against the live project.
- [ ] Schema drift check green in CI.
- [ ] `profile > 1` in production — the institution has real, individually attributed accounts.
- [ ] `signature > 0` — certificates are signed.
- [ ] `academic_calendar` populated for the current year.
- [ ] Every screen has a test file.
- [ ] Zero axe violations across the module.
- [ ] Advisors: zero ERROR, WARNs triaged with written rationale.
- [ ] Runbook updated with settings-recovery procedures.
- [ ] Rollback plan documented for the Basic Config split migration.

---

## 5. Effort and sequencing

| Phase | Scope | Effort | Blocking |
|---|---|---|---|
| 0 | Critical fixes | 3 d | Ships nothing until done |
| 1 | Access control + invite | 1 w | Blocks the entire RBAC value story |
| 2 | Validation + integrity | 1 w | Blocks trustworthy configuration |
| 3 | Accessibility | 4 d | Blocks public-institution procurement |
| 4 | Hub + data contract + IA | 1.5 w | Blocks the onboarding story |
| 5 | Screen features | 2 w | Parallelisable per screen |
| 6 | New screens | 2 w | Depends on Phase 4's IA |
| 7 | Design system | 4 d | Parallel with 5 |
| 8 | Performance | 3 d | Before multi-tenant scale-out |
| 9 | Testing + readiness | continuous | Gate on every phase |

**Total: ~9 weeks for one engineer, ~5 weeks for two working in parallel from Phase 4.**

**Recommended cut for a 2-week window:** Phase 0 complete, Phase 1.1 and 1.2, Phase 2's StartUp and Subject validation, Phase 3's A-1/A-2/A-8, and Phase 4.1's hub. That converts the module from "not shippable" to "shippable with known gaps" and unblocks the access-control story that everything else in the product depends on.
