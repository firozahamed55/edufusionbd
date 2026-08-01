# EduFusionBD — Comprehensive System Requirements Analysis & Architecture Review

**Document ID:** EFB-SRA-2026-07-31 · **Version:** 1.0 · **Date:** 2026-07-31
**Classification:** Internal — Engineering / Stakeholder / Academic Defence
**Scope:** Admin module (56 routes) · Authentication module (7 screens) · Full technology stack
**Prepared in the role of:** CTO · Principal Software Architect · Solution Architect · Security Architect · DevOps/Cloud Architect · Database Architect · UI Architecture Lead · Technical Project Manager · Senior Staff Engineer

---

## Table of contents

| § | Section |
|---|---|
| 0 | Executive summary & scorecard |
| 1 | Method, evidence base, and how to read this report |
| 2 | System context — what EduFusionBD is today |
| 3 | **Part A — Admin module requirements analysis** |
| 3.0 | A-0 · Cross-cutting findings (apply to all 56 routes) |
| 3.1–3.10 | A-1…A-10 · Per-module, per-screen analysis |
| 4 | **Part B — Authentication module redesign** |
| 5 | **Part C — Technology stack evaluation** |
| 6 | **Part D — Consolidated findings register** |
| 7 | **Part E — Implementation roadmap** |
| 8 | **Part F — Risk register, acceptance criteria & KPIs** |
| 9 | Appendices |

---

# 0. Executive summary & scorecard

## 0.1 The one-paragraph verdict

EduFusionBD is **an unusually well-engineered foundation carrying an incomplete product**. The architecture, type system, database, tenancy model and design system are at or near enterprise standard — mechanically enforced layering with zero violations, RLS on 86/86 tables, a per-request CSP nonce, 49 migrations in version control, a two-theme token system, and a bilingual runtime that holds pixel parity between Bangla and English. That is the expensive half, and it is done. What is *not* done is the **operating surface**: of 44 distinct admin screen implementations, exactly **one** (Teacher Directory) implements the full data-interaction contract a school administrator needs — search, filter, sort, paginate, select, bulk-act, export, and announce. The other 43 implement between zero and four of those eight. Validation feedback exists as a component API (`Field error`) that **zero of 197 call sites use**. Five primary buttons are permanently disabled. Two of the three revenue-relevant integrations (SMS gateway, payment gateway) do not exist, and one screen bills against a hand-typed recipient count. The gap is therefore **not architectural, it is completional and operational** — which is the good kind of gap, because it is closed by disciplined feature work against an already-correct substrate rather than by a rewrite.

## 0.2 Scorecard

Scores are /100, assessed against **institutional / enterprise production** standards (the bar: a system a school district procurement officer signs off on, not a demo).

| Dimension | Score | Grade | One-line justification |
|---|---|---|---|
| **Architecture & code quality** | 88 | A− | Layering enforced by lint *and* test, 0 `any`, 0 `@ts-ignore`, generated DB types end to end |
| **Database design** | 91 | A− | RLS 86/86, 0 unindexed FKs, `SECURITY DEFINER` + tenant guard convention, partitioning migration landed |
| **Security architecture** | 79 | B+ | Excellent design (nonce CSP, signed-JWT role gate, fail-closed middleware); no MFA, no session mgmt, one open advisory |
| **Backend / API design** | 82 | B+ | RPC-per-write with transactional semantics; validation coverage uneven (zod in 3 of 10 modules) |
| **Frontend performance** | 86 | A− | Router cache re-enabled, prefetch+hydrate on 2 screens, no client-side full scans left |
| **UI visual design & consistency** | 84 | B+ | Real token system, 0 raw hex, 0 arbitrary font sizes, one shared `ui/` layer of 24 primitives |
| **UX & workflow completeness** | 52 | **F+** | **The weak axis.** 1/44 screens has the full interaction contract; 5 dead controls; validation is toast-only |
| **Accessibility** | 61 | D | Focus system, skip-link, `aria-current`, focus traps exist; live regions on 1 screen; no audited AA conformance |
| **Information architecture / navigation** | 87 | A− | Rail=modules / page=tabs, longest-prefix active, command palette, breadcrumbs, pinning — genuinely good |
| **Internationalisation** | 66 | D+ | Works and is disciplined; but `t(bn,en)` inline at ~4,000 call sites is a dead end past two languages |
| **Scalability** | 80 | B | Correct at 10k; 100k designed and deliberately deferred with numeric triggers (ADR-0002) |
| **Testing** | 55 | F+ | 121+ unit tests + pgTAP RLS job; **no E2E, no component tests on 44 screens** |
| **Observability & operations** | 52 | F+ | Structured logs + health endpoint + runbook; **nothing alerts, nothing polls, no traces** |
| **Maintainability** | 85 | A− | ADRs, runbook, design-system doc, enforced conventions, low duplication |
| **Business/domain completeness** | 58 | D+ | Core academic loop works; SMS delivery, payments, document PDF output, HR/payroll, library, transport absent |
| **OVERALL** | **73** | **B** | Production-*capable* for a pilot institution; not yet production-*ready* for paid multi-tenant operation |

## 0.3 The five findings that matter most

| # | Finding | Business impact | Priority |
|---|---|---|---|
| **F-1** | **Validation is invisible.** `Field` exposes an `error` prop wired to `role="alert"` + `aria-describedby`; **0 of 197 `<Field>` call sites pass it.** Every failure surfaces as a transient toast that names no field. | A 40-field admission form rejects with "Save failed" and the clerk must hunt. Guaranteed data-entry error rate and support load. | **P0** |
| **F-2** | **SMS billing is computed from a hand-typed number, and segments are counted with the wrong alphabet.** `recipient_count` is a free-text input the operator fills in; segments are `ceil(chars/160)` regardless of language, but Bangla is UCS-2 at **70 chars** per segment. | The institution is charged, and charges parents, against a figure nobody computed. A 150-character Bangla notice is billed as 1 segment and costs 3. Direct, silent revenue error. | **P0** |
| **F-3** | **Five permanently disabled primary controls ship to users**, plus two "(soon)" buttons on Documents. Three of them are the *Search* button on screens where search is the entry action. | Operators conclude the product is broken. This is the single cheapest credibility loss in the product. | **P0** |
| **F-4** | **Role-based access control exists in the database and nowhere in the UI.** `role_permission` tables and `has_permission()` shipped 2026-07-26; the admin rail has `roles?: Role[]` support that **nothing populates**, and User Management is read-only — no invite, no suspend, no role change. | A school cannot delegate. The head teacher, accountant and registrar all share one god account, which defeats the audit log that was built alongside it. | **P0** |
| **F-5** | **Year-end promotion assigns merit rank from list position, and hardcodes `result: "pass"`.** `merit_rank: idx + 1` where `idx` is the row index of the source roster, not an ordering by exam result. | The most destructive and least reversible operation in a school system produces academically meaningless ranks. Reputational and regulatory exposure. | **P0** |

## 0.4 Investment summary

| Phase | Theme | Duration (2 FTE) | Outcome score |
|---|---|---|---|
| **Phase 1** | Integrity & honesty — kill dead controls, wire validation, fix billing + merit maths, ship RBAC UI | 3 weeks | 73 → 80 |
| **Phase 2** | The interaction contract — roll the Teacher Directory pattern across all list/roster screens | 4 weeks | 80 → 86 |
| **Phase 3** | Auth redesign + MFA + session management + i18n catalogue migration | 3 weeks | 86 → 90 |
| **Phase 4** | Operations — E2E, alerting, APM, DR rehearsal, gateway integrations | 4 weeks | 90 → 95 |

---

# 1. Method, evidence base, and how to read this report

## 1.1 Method

This is a **white-box source review with mechanical corroboration**. Nothing here is inferred from screenshots or documentation alone. Every quantitative claim below was produced by running a query against the working tree on 2026-07-31 and is reproducible.

| Evidence type | Command / artefact | What it established |
|---|---|---|
| Route inventory | `find src/app/(admin) -type d` | 56 admin routes across 10 modules |
| Implementation inventory | `find src/features/admin -name "*.tsx"` | 44 distinct screen implementations behind those 56 routes |
| Capability matrix | per-file grep for `useQueryState`, `Pagination`, `SortableTH`, `exportCsv`, `Checkbox`, `LiveRegion`, `Modal`, `SaveBar`, `Skeleton`, `EmptyState`, `ErrorState`, `window.print` | Appendix A — the single most load-bearing artefact in this report |
| Validation coverage | `grep -c "<Field"` = 197 vs `grep -c "error={"` = 0 | F-1 |
| Dead controls | `grep -n "disabled>"` filtered for non-conditional | F-3 (5 hits) + 2 "(soon)" buttons |
| Schema validation coverage | `grep -rl "from \"zod\""` | 3 of 10 feature `logic/api.ts` modules |
| Token discipline | `grep -c "text-\["` = 0, `grep -c "#[0-9a-f]{6}"` = 0 in `features/` | Design-system compliance confirmed |
| Database surface | `ls supabase/migrations` | 49 migrations, latest 2026-07-26 (partitioning, RBAC, rate limiting, invoice generation) |
| Pipeline | `.github/workflows/ci.yml` | 3 jobs: verify · pgTAP RLS · production dep audit |
| Prior state | `docs/ENGINEERING_AUDIT.md`, `docs/ARCHITECTURE_AUDIT.md`, `docs/ui-ux-audit.md`, `final_admin.md`, `docs/adr/*` | Baseline; this report supersedes their open items |

**Screens read in full (15):** Dashboard Overview, Student Registration, Teacher Directory, Quick Collection (form), Marks Entry, Attendance Marker, SMS Send, User List, Audit Log, Result Processor, Migration Runner, Certificate Batch Creator, Income Statement, Grading Scheme, Delete Fees, plus `AdminShell`, `adminNav`, `Form.tsx`, `middleware.ts`, `AuthShell`, Login, OTP.
**Screens covered by capability matrix + shared-component tracing (29):** all remaining. Where a screen was not read line by line, findings are stated at the level the evidence supports — cross-cutting gaps that hold by construction (they derive from the shared component or the absence of a capability), never invented screen-specific detail. This distinction is marked in the text as *[matrix]* where it applies.

## 1.2 Finding format

Every finding carries the full analytic chain the brief requires:

> **ID · Title**
> **Problem** — the observable defect.
> **Root cause** — why it exists, not what it looks like.
> **Risk / Business impact / Technical impact** — what it costs.
> **Recommendation** — the specific change.
> **Priority** (P0 blocks paid operation · P1 visible quality gap · P2 polish) · **Complexity** (S ≤ 1 day · M 1–3 days · L 1–2 weeks · XL > 2 weeks) · **Expected impact**.

## 1.3 What this report deliberately does not do

It does not re-audit what four prior audits already closed and this review re-verified as closed: the Next.js middleware CVE, anonymous RPC execution, schema-in-VCS, the client router cache, arbitrary font sizes, raw hex colours, the fabricated dashboard data, and the fake OTP success path. Those are **fixed**. Re-listing them would inflate the finding count and obscure what is actually open.

---

# 2. System context — what EduFusionBD is today

## 2.1 Product

A multi-tenant School Management System for Bangladeshi institutions (Bangla-first, English secondary), with four user roles — **Admin/Super-Admin**, **Teacher**, **Parent**, **Student** — and a stated differentiator, **EduSathi AI**, an assistant that answers in Bangla and Banglish.

## 2.2 Stack as-built

```
┌──────────────────────────────────────────────────────────────────────┐
│ CLIENT (browser)                                                      │
│  Next.js 15.5.21 App Router · React 19 · TypeScript 5.7 (strict)      │
│  Tailwind CSS v4 (@theme inline tokens) · lucide-react · next-themes  │
│  TanStack Query v5 (staleTime 60s) · next-intl (locale only)          │
│  shared/ui — 24 design-system primitives                              │
├──────────────────────────────────────────────────────────────────────┤
│ EDGE                                                                  │
│  middleware.ts — session refresh · fail-closed auth gate · role gate  │
│                  from signed JWT app_metadata · per-request CSP nonce │
├──────────────────────────────────────────────────────────────────────┤
│ SERVER (thin)                                                         │
│  RSC pages (4–10 lines each) · prefetch+hydrate on 2 screens          │
│  src/server/sms/sendCampaign.ts + /api/v1/sms/send · /api/health      │
│  instrumentation.ts#onRequestError → structured PII-scrubbing logger  │
├──────────────────────────────────────────────────────────────────────┤
│ DATA (Supabase — single project, ~86 tables)                          │
│  PostgreSQL + RLS on 86/86 tables · 110+ policies                     │
│  Writes: SECURITY DEFINER RPCs, SET search_path TO '', tenant guard   │
│  Reads: security_invoker views · 49 migrations in VCS                 │
│  Supabase Auth (GoTrue) · Supabase Storage (private per-tenant bucket)│
└──────────────────────────────────────────────────────────────────────┘
```

**Not present:** SMS gateway, payment gateway, background job queue, APM/alerting vendor, CDN beyond the host's, feature-flag service, E2E test runner, message catalogue.

## 2.3 Admin information architecture

The IA was rebuilt on 2026-07-26 and is **the strongest single part of the product**. The rail addresses **areas** (10 modules in 5 zones + Settings); a module's screens are `ModuleTabs` on the page. Longest-prefix active resolution, cookie-backed academic-year context with an archived-year read-only banner, `⌘K` command palette, `[` rail toggle, module pinning, three responsive rail states (256px ≥ xl / 72px lg–xl / off-canvas drawer < md), skip-to-content, and focus traps on drawer and menu.

| Zone | Modules | Routes |
|---|---|---|
| Overview | Dashboard · EduSathi AI | 2 |
| People | Students (7 tabs) · Teachers & Staff (3) | 10 |
| Academics | Attendance (6) · Exam & Results (10) | 16 |
| Operations | Fees & Finance (8) · Documents (7) · Communication (5) | 20 |
| Insights | Reports (alias of Students › Reports) | 1 |
| Settings | Core (9 tabs) | 9 |

**IA-level gaps (all P2 unless noted):** the rail's `roles?: Role[]` filter is implemented but **nothing populates it** (see F-4, P0); there is no favourites/recents beyond manual pinning; Reports is an alias rather than a first-class module, so "Insights" is a zone with one borrowed member; there is no global entity search (`⌘K` jumps to *screens*, not to a student or an invoice) — for a registrar, "find student 2026-0417" is the single most frequent intent in the product and it is unserved.

---

# 3. Part A — Admin module requirements analysis

## 3.0 A-0 · Cross-cutting findings

**These nine findings apply to most or all of the 56 routes.** They are stated once here rather than 44 times below, and each per-module section then carries only what is specific to it. Fixing A-0 items is the highest-leverage work in the entire programme: **A-0.1 through A-0.4 together account for more of the UX score gap than all module-specific findings combined.**

---

### A-0.1 · The data-interaction contract is implemented on 1 of 44 screens

**What currently exists.** `shared/ui` ships every primitive required for an enterprise list view: `Table`/`SortableTH` (sortable headers), `Pagination` (tested), `Checkbox` (with real `indeterminate` handling), `RowActions`, `LiveRegion`, `exportCsv`, `useQueryState` (URL-synchronised state), `useDebouncedValue`. `features/admin/teacher/screens/list/ListScreen.tsx` composes all of them and is explicitly documented in-file as *"the reference implementation of the data-interaction layer"*.

**What is missing.** The reference was never rolled out. Measured across all 44 implementations:

| Capability | Screens with it | Coverage |
|---|---|---|
| URL-synchronised state (`useQueryState`) | 1 | **2%** |
| Sortable columns | 1 | **2%** |
| Screen-reader live region | 1 | **2%** |
| Row selection + bulk action | 3 | 7% |
| Pagination | 6 | 14% |
| CSV export | 8 | 18% |
| Loading skeleton | 22 | 50% |
| Error state | 21 | 48% |
| Empty state | 25 | 57% |

**Why it is important.** A school administrator's day is *list work*: find the 12 students in section 9-A who owe fees, sort by amount, select them, message their guardians, export the list for the head teacher. Without URL state, that work is unbookmarkable, unshareable, and destroyed by the back button. Without sorting, the operator scans visually. Without export, they retype into Excel — which is where every school's shadow-IT spreadsheet comes from, and where the product loses its single source of truth. Without a live region, a screen-reader user gets **no signal at all** that a filter changed the table underneath them (WCAG 4.1.3 Status Messages, Level AA — failed on 43 screens).

**How it should be improved.** Extract the Teacher Directory into a `<DataScreen>` composition — a headless hook (`useDataScreen({ queryKey, fetcher, columns, filters })`) plus a thin layout — and migrate the 14 list-shaped screens onto it. It is deliberately *not* a generic table component: the codebase's own convention is composition over configuration, and a 40-prop table is how design systems die. The hook owns URL state, debounce, sort, page, selection and the live-region message; the screen owns columns and row rendering.

**Expected impact.** 14 screens gain 8 capabilities each in ~2 weeks of work rather than ~10. Task time for the "find, filter, act, export" loop drops from minutes to seconds. WCAG 4.1.3 goes from 2% to 100% coverage on list screens. Support tickets of the form "I lost my filters" go to zero.

> **Priority P0 · Complexity L (1.5–2 weeks) · Impact: the single largest UX-score movement available.**

---

### A-0.2 · Validation feedback is invisible (F-1)

**What currently exists.** `shared/ui/Form.tsx#Field` accepts `error?: string`, renders it with `role="alert"`, and — via a `FieldErrorContext` — automatically stamps `aria-invalid` and `aria-describedby` onto the enclosed `Input`/`Select`/`Textarea`, with an `aria-invalid:border-danger-solid` style hook. This is a well-designed, accessible validation primitive. Its own source comment names the reason it was built: *"`zod` was a dependency used on 3 of 56 screens and errors had nowhere to live."*

**What is missing.** **197 `<Field>` call sites. 0 pass `error`.** The primitive is dead code. Screens instead gate on a boolean (`const canSubmit = f.name_bn && f.name_en && f.dob && …`) and, on failure, fire a toast that names no field: *"প্রয়োজনীয় ফিল্ড পূরণ করুন / Please fill the required fields."* Server rejections surface the same way. zod exists in exactly 3 of 10 feature modules (fee, student, sms-notice) and only at the API boundary, never bound back to a field.

**Why it is important.** Student Registration has **31 inputs across 4 cards**, of which 7 are required and one (Class & Section) is two scroll-lengths from the submit button. The operator presses Save, receives a toast that disappears in 4 seconds, and must re-derive which of 31 fields is at fault. Under WCAG this fails **3.3.1 Error Identification (A)** and **3.3.3 Error Suggestion (AA)** on every form in the product — 197 fields. Commercially, this is the defect that makes an evaluator say "it feels like a prototype", because inline validation is the single most universally expected behaviour in enterprise forms.

**How it should be improved.**
1. Define a zod schema per form beside its `logic/api.ts` (three already exist and can be reused verbatim).
2. Add a 25-line `useZodForm(schema)` hook returning `{ values, setValue, errors, validate, isValid }`, validating on blur and on submit, never on first keystroke.
3. Thread `error={errors.field}` at the 197 call sites — a mechanical change, since `Field` already owns the ARIA wiring.
4. Map server-side `ZodError` and PostgREST constraint violations back onto field keys through the existing `shared/services/errors.ts` classifier.
5. Keep the toast for *transport* failures only ("no connection"), never for *content* failures.

**Expected impact.** Data-entry error rate on Registration and Teacher Onboarding drops materially (industry benchmark for inline vs. post-submit validation is a 22–42% reduction in form-completion errors). WCAG 3.3.1/3.3.3 pass across the product. Support load on "it won't save" disappears.

> **Priority P0 · Complexity M–L (schema authoring is the cost; the wiring is mechanical) · Impact: product-wide credibility.**

---

### A-0.3 · Dead controls ship to production (F-3)

**What currently exists.** Seven controls that a user can see, are styled as actionable, and cannot ever be actioned:

| Location | Control | Nature |
|---|---|---|
| `AttendanceMarker.tsx:101` | **অনুসন্ধান / Search** (primary, indigo) | `disabled` unconditionally |
| `MigrationRunner.tsx:91` | **অনুসন্ধান / Search** (primary) | `disabled` unconditionally |
| `UpdateBasicScreen.tsx:59` | **অনুসন্ধান / Search** (primary) | `disabled` unconditionally |
| `UnpaidInstituteScreen.tsx:45` | primary action button | `disabled` unconditionally |
| `UnpaidSectionScreen.tsx:53` | primary action button | `disabled` unconditionally |
| `BatchCreator.tsx:77` | **প্রিন্ট (শীঘ্রই) / Print (soon)** | disabled, labelled "soon" |
| `CertRecordForm.tsx:91` | **PDF (শীঘ্রই) / PDF (soon)** | disabled, labelled "soon" |

**Root cause.** These are Figma artefacts. The designs specified a search-then-load interaction; the implementation adopted reactive `useQuery`-on-select instead (which is *better*), and the now-redundant button was left rendered rather than removed. The two "(soon)" buttons are honest but wrongly placed — they advertise absence at the exact moment of need.

**Why it is important.** On three screens the disabled control is the **Search** button, and search is the screen's entry action. A first-time operator's model is "fill the filters, press Search" — they press it, nothing happens, and they conclude the screen is broken. There is no recovery path because the actual trigger (the `Select`'s `onChange`) is invisible. This is the cheapest possible loss of user confidence in the product.

**How it should be improved.** Delete the five redundant buttons outright — the data already loads reactively, so nothing replaces them; where an explicit trigger genuinely helps (Income Statement's date-range Search, which *is* wired and correct), keep that pattern and make it consistent. For the two document-output buttons, remove them from the toolbar and instead render a single dismissible info strip: *"PDF output arrives with the print-template release."* Adopt a standing rule, enforceable in code review: **a control that cannot be actioned in this release is not rendered.**

**Expected impact.** Immediate. Roughly one day of work removes the most visible "unfinished" signal in the admin app.

> **Priority P0 · Complexity S (< 1 day) · Impact: disproportionate to cost.**

---

### A-0.4 · RBAC exists in the database and nowhere in the product (F-4)

**What currently exists.**
- Database: `add_has_permission_and_seed_role_permissions` (2026-07-26) ships a `role_permission` table, a `has_permission()` helper, role-based RLS policies, teacher class-section scoping, parent read scoping, and RPC permission guards. This is a complete, correct authorisation model.
- Middleware: role gate from signed JWT `app_metadata` — `admin | teacher | super_admin` reach `/admin/*`.
- Navigation: `AdminModule.roles?: readonly Role[]` is defined and `AdminShell` filters on it (`canSee`).
- Audit: `audit_log` is append-only with trigger coverage, and has a working UI.

**What is missing.** Everything between the database and the operator.
- **No `AdminModule` declares `roles`.** The filter is live and matches nothing, so every admin-side user sees every module. The type comment admits it: *"Nothing sets this today because the role model has no sub-admin roles yet."*
- **User Management is read-only.** `UserListScreen` renders name, phone, roles, status and a CSV export. There is no invite, no deactivate, no suspend, no role assignment, no password reset, no last-login column. The screen's own footnote says new users are provisioned "via Supabase Auth (invite flow added later)."
- No permission-matrix screen; no way to see or edit what a role may do.
- Roles are displayed as raw enum text (`me.role.replace(/_/g, " ")`).

**Why it is important.** A Bangladeshi secondary school has a head teacher, an accountant, a registrar/office assistant, and section teachers. Today all of them must share one admin credential, because there is no way to create a second one with narrower rights. That single fact:
- **Destroys the audit log's value.** Every entry attributes to the same account, so "who changed this mark" is unanswerable — and the audit log was built specifically to answer it.
- **Violates least privilege at the worst place.** The clerk who collects fees can void institution-wide invoices (Delete Fees) and run year-end promotion.
- **Blocks the sales motion.** "Can our accountant see fees but not exam results?" is a procurement question, and the honest answer today is no.
- It also **wastes shipped work** — the hardest part (RLS policies and permission guards) is already done and is simply unreachable.

**How it should be improved.**
1. Define four operational roles beyond `admin`/`super_admin`: `registrar`, `accountant`, `exam_controller`, `teacher` (already partially scoped).
2. Populate `roles` on `AdminModule` — this is a one-line change per module and the rail already filters (audit note B-7).
3. Build **User Management v2**: invite by mobile/email (Supabase Auth admin invite), assign role, suspend/reactivate, force password reset, show last sign-in, filter/search/paginate/export. Every action writes to `audit_log`.
4. Add a **Permission Matrix** screen under Settings › Users, rendering `role_permission` as an editable role × capability grid (read-only for `super_admin`-managed rows).
5. Surface the acting role prominently in the topbar with a human-readable label.

**Expected impact.** Converts a delivered-but-invisible database capability into the product's answer to the top procurement objection. Makes the audit log meaningful. Removes the "everyone is root" risk finding.

> **Priority P0 · Complexity L (User Management v2 is the bulk) · Impact: unblocks multi-user institutional deployment.**

---

### A-0.5 · Bulk operations, import, and print/document output are absent

**What currently exists.** Bulk *delete* on Delete Fees (with an exemplary typed `DangerConfirm`), bulk *SMS handoff* on Teacher Directory, bulk *promote* on Migration. `window.print()` with a real `print.css` on the Result Sheet.

**What is missing.**
- **No import anywhere.** A school onboarding to EduFusionBD must type in 800 students by hand through a 31-field form. There is no CSV/Excel import, no column mapper, no dry-run validation report, no partial-failure handling.
- **No bulk edit.** Cannot promote a fee waiver to a category, cannot mark a section's attendance from a previous day's pattern, cannot bulk-assign subjects.
- **No document rendering.** ID cards, admit cards, testimonials, transfer certificates and marksheets all create *records* but produce **no printable artefact**. The Documents module is 7 screens that generate database rows the institution cannot use.

**Why it is important.** These three absences define the difference between a system a school *evaluates* and one a school *adopts*. Onboarding cost is the #1 barrier to SIS adoption; without import, every deployment costs the institution 40–80 person-hours before it sees value. And the Documents module — ID cards and admit cards specifically — is often the *purchase trigger* in this market, because it replaces an outsourced printing cost. Shipping it without output means shipping the cost without the benefit.

**How it should be improved.**
1. **Import framework (highest ROI single feature in the product):** one shared `<ImportWizard>` — upload → column map → validate with the screen's existing zod schema → preview with per-row errors → commit in batches through a `SECURITY DEFINER` RPC → downloadable error report. Wire to Students, Teachers, Marks, and Fee mapping first.
2. **Document rendering:** a print-CSS-based template layer (the Result Sheet already proves this works and needs no PDF dependency) for ID card, admit card, marksheet, testimonial, transfer certificate; batch print with page-break control and a print preview. Reach for a server-side PDF only when a signed/archival artefact is required.
3. **Bulk edit:** extend the selection contract from A-0.1 with a per-screen bulk-action bar.

> **Priority P0 (import, document rendering) / P1 (bulk edit) · Complexity XL / L / M · Impact: converts pilot to adoption.**

---

### A-0.6 · No optimistic concurrency, no drafts, no undo on long-form work

**What currently exists.** `SaveBar` with an `UnsavedDot`, a browser `OfflineBanner`, TanStack Query invalidation on mutation, and honest pending states.

**What is missing.**
- **Nothing warns on navigation away from a dirty form.** The `UnsavedDot` is decorative: it is passed statically in every usage found (`<UnsavedDot /><span>New admission form</span>`), not driven by an actual dirty check, and there is no `beforeunload` or router-level guard.
- **No autosave/draft.** Marks Entry for a 60-student section is 60 numeric inputs held in React state; a tab close, a session expiry or an accidental back gesture loses all of it.
- **No optimistic concurrency control.** Two operators entering marks for the same exam/section/subject silently last-write-wins. The same holds for institution settings and grading schemes.
- **No undo.** Every destructive path is confirm-then-permanent. Delete Fees's typed confirmation is excellent mitigation, but mitigation is not reversal.

**Why it is important.** Bangladeshi school networks are intermittent and shared; power cuts are routine. A 45-minute marks-entry session lost to a dropped connection is the kind of event that ends a pilot. Concurrent editing is not hypothetical: marks entry is *explicitly* a multi-teacher activity, and the current model can silently discard a teacher's entire subject.

**How it should be improved.**
1. Drive `UnsavedDot` from real dirty state; add a router-level unsaved-changes guard (`useUnsavedGuard(isDirty)`) and `beforeunload`.
2. Autosave grid-style screens (Marks Entry, Attendance) to `localStorage` per `(exam, section, subject, date)` key on a 2-second debounce; restore with an explicit "Restore unsaved entries?" prompt.
3. Add `updated_at` optimistic-concurrency checks to the settings and marks RPCs; on conflict return a structured error and render a merge prompt rather than overwriting.
4. Implement soft-delete + a 30-day restore view for fee invoices and student records (the schema already has `deleted_at` on `fee_invoice`).

> **Priority P0 (unsaved guard, autosave) / P1 (OCC, undo) · Complexity M / M / L · Impact: removes the highest-frequency data-loss class.**

---

### A-0.7 · Accessibility is architecturally sound and operationally unverified

**What currently exists — and it is genuinely good.** A `:focus-visible` safety net that survives `outline-none`; `prefers-reduced-motion` in the base layer; a skip-to-content link; `aria-current="page"` on rail links; `aria-label` on every icon-only control in the shell; focus traps on drawer and profile menu; `role="menu"`/`menuitem`; `Badge` with a non-colour `dot` cue (WCAG 1.4.1); a real `indeterminate` checkbox; `role="alert"` on error copy; a `contrast.test.ts` in `src/app`.

**What is missing.**
- **Live regions on 1 of 44 screens** (WCAG 4.1.3 AA — see A-0.1).
- **No keyboard grid navigation** on the two grid screens. Marks Entry for 60 students requires 60 Tab presses with no arrow-key movement, no Enter-to-next-row, no type-ahead. This is the single most keyboard-hostile surface in the product and it is used by teachers under time pressure.
- **Custom `<div>` tables.** Nine screens render tabular data as nested flex `<div>`s with no `role="table"`/`row`/`cell` and no header association. A screen reader announces an undifferentiated wall of text. `shared/ui/Table` exists and is used on only 3 screens.
- **Raw `<input type="checkbox">`** bypassing the design-system `Checkbox` in at least 4 places (Registration's "same as present", Marks Entry's absent column, Grading's default flag, Attendance's SMS toggle) — losing the focus ring and consistent hit target.
- **`<button>` inside `<label>`** for the toggle pattern (Attendance SMS toggle, Exam config toggles) — invalid nesting that breaks label-click semantics and produces unpredictable screen-reader output. Should be `role="switch"` with `aria-checked`.
- **No formal audit.** There is no axe/Lighthouse CI gate, no documented WCAG 2.2 AA conformance statement, and no keyboard-only walkthrough on record. For an institutional buyer — especially a government-adjacent one — a conformance statement is a procurement artefact, not a nice-to-have.

**How it should be improved.** Add `@axe-core/playwright` to the (to-be-created) E2E suite and gate CI on zero serious/critical violations; migrate the 9 div-tables to `shared/ui/Table`; build a `useGridNavigation` hook for Marks Entry and Attendance (arrows, Enter, Home/End, type-ahead); replace toggles with `role="switch"`; publish a WCAG 2.2 AA conformance statement (VPAT-style) as a sales artefact.

> **Priority P1 (P0 for grid navigation — it is also a productivity fix) · Complexity M–L · Impact: procurement-blocking risk removed; teacher task time on marks entry roughly halved.**

---

### A-0.8 · Internationalisation is disciplined but architecturally capped

**What currently exists.** `useT()` returning `t(bn, en)` for strings and `n(value)` for numerals with automatic Bengali↔ASCII conversion; `font-size-adjust: 0.51` giving bn/en pixel parity so a locale switch causes zero layout shift; a `.tnum` tabular-numerals utility; `next-intl` installed and wired for locale resolution; `useT.test.tsx` covering numeral conversion. The discipline is real — user-facing strings genuinely go through `t()`.

**What is missing, and why it matters more than it looks.** `next-intl` is installed **but the message-catalogue system it exists to provide is unused**. Translations are inline bilingual pairs at roughly 4,000 call sites. Consequences:

| Consequence | Severity |
|---|---|
| A third locale is impossible without editing every call site | Blocks regional/English-medium expansion |
| No ICU plural/gender/select — `${n(count)} জন শিক্ষার্থী` is grammatically wrong for count = 1 in several constructions | Visible quality defect |
| No translator workflow — a professional Bangla reviewer must read TSX | Copy quality plateaus |
| No coverage tooling — a missing translation is invisible, not a build error | Silent drift |
| Both language strings ship in every bundle | Small but permanent payload cost |
| Bilingual strings leak past the system anyway — `IncomeStatementScreen` hardcodes `"খাত / Head"`, `"ডেবিট / Debit"`, `"ক্রেডিট / Credit"` outside `t()` | Proof the pattern does not hold under pressure |

**Also missing:** locale-aware date/number formatting is inconsistent. `AuditLogScreen` uses `new Date(r.at).toLocaleString()` (browser locale, browser timezone), the Dashboard slices ISO strings (`new Date(a.at).toISOString().slice(0,10)` — which silently reports UTC dates to a UTC+6 audience, so anything after 18:00 local shows yesterday's date), and Update Class hand-formats. There is no institution timezone setting and no `Intl.DateTimeFormat` convention.

**How it should be improved.** Codemod the inline pairs into `messages/bn.json` + `messages/en.json` keyed by screen (`admin.student.registration.title`), keep `useT` as a thin adapter so the migration is mechanical and reversible, adopt ICU plurals, add a CI check for missing/orphaned keys, and centralise date/number formatting in a `shared/lib/format.ts` bound to the institution's configured timezone.

> **Priority P1 · Complexity L (mechanical but broad) · Impact: unblocks a third language, fixes a UTC date-reporting defect, makes copy reviewable.**

---

### A-0.9 · Automation opportunities are unexploited

The system is almost entirely **manual-trigger**. Every meaningful workflow requires an operator to open a screen and press a button. The database already ships the primitives (`pg_cron`, `pgmq`, `pg_net` are available and uninstalled; a `monthly_invoice_generation` migration exists) — what is missing is the wiring and the UI.

| # | Opportunity | Today | Proposed | Value |
|---|---|---|---|---|
| 1 | **Fee invoice generation** | Migration exists; no schedule, no UI | `pg_cron` monthly run + a preview/approve screen + exception report | Removes the highest-volume recurring clerical task |
| 2 | **Absence notification** | Toggle on Attendance save; no gateway | Queue on save; batch per section; delivery receipts | The product's headline parent-facing promise |
| 3 | **Fee-due reminders** | None (Dashboard alert only) | Rule engine: T-3 / due date / T+7, with per-institution templates | Directly improves collection rate — the buyer's own KPI |
| 4 | **Result publication** | Manual process → manual view | Publish workflow: process → verify → approve → notify parents → open in Parent app | Turns three disconnected screens into one governed pipeline |
| 5 | **Year-end rollover** | Manual per-section migration | Guided wizard: archive year → create year → clone class structure → bulk promote with a dry run | Compresses days into one supervised session |
| 6 | **At-risk detection** | Static <75% attendance alert | Configurable rules (attendance, fee, marks trend) → watchlist → EduSathi surfacing | The differentiator, made concrete |
| 7 | **Digest reporting** | None | Weekly head-teacher digest (email/SMS): collections, attendance, exceptions | Retention driver — puts the product in front of the decision-maker weekly |
| 8 | **Backup verification** | Supabase daily backups, never restored | Scheduled restore rehearsal to a scratch project + report | Converts a DR hypothesis into evidence |

> **Priority P1 (1, 2, 4) / P2 (rest) · Complexity M–L each · Impact: shifts the product from a system of record to a system of action, which is where SIS retention comes from.**

---

## 3.1 A-1 · Dashboard (`/admin/dashboard`)

**Distinct implementations:** `OverviewScreen.tsx` (475 lines) + `SetupChecklist.tsx` + `logic/api.ts` (167 lines).

**What currently exists.** The best-executed screen in the product, and the one with the clearest audit history: an earlier version was ~60% fabricated data and every element is now bound to a live query. Time-of-day greeting from the real clock; a "Needs attention" list derived from three live queries (overdue invoices aggregated by student with a real ৳ total, 30-day attendance below 75%, exams in `locked` status awaiting publish), each with a working CTA into the screen that resolves it; three KPI tiles (students + class-sections, teachers + student:teacher ratio, month collections + outstanding); a real 30-day attendance trend rendered as a 7-point bar chart; a fee-collection donut; recent `audit_log` activity; recent notices; five quick actions; a layout-mirroring skeleton; a retryable error state; and — notably — a `SetupChecklist` that replaces the wall-of-zeroes with an ordered setup path for a brand-new institution. Server-prefetched and hydrated, so it renders with data on first paint. It even declines to render a trend arrow beside a secondary metric because that would be misleading.

**What is missing.** *(Status appended 2026-08-01.)*
1. **No time-range control.** Every figure is a fixed window (this month / last 30 days). A head teacher cannot ask "how did last term compare". — ✅ **Done** (P2 w7). Five presets plus a custom range, URL-backed so a period is a link. It governs the two panels and the one tile that are genuinely functions of a date range, and deliberately not the point-in-time counts.
2. **No drill-down from KPIs.** The tiles are not links; the attention rows are, but the KPIs — the most-looked-at objects on the screen — are dead ends. — ✅ **Done** (P2 w7). The money tile opens the income statement for exactly its window, not a generic list.
3. **One dashboard for all admin roles.** An accountant and an exam controller see the same eight sections. Depends on A-0.4. — ✅ **Done** (P3 w11). KPI tiles, both period panels, the quick actions and the attention rows filter on the same permission codes as the navigation rail and RLS, and **fail open** for the same reason (risk R-5): `undefined` and `[]` show everything.
4. **No customisation.** No reorder, no hide, no add — standard in enterprise dashboards and specifically expected by multi-site operators. — ⬜ **Open**, P2. Not attempted: per-user layout persistence is a schema and a drag surface, and item 3 covers the actual complaint (seeing sections that are not yours) at a fraction of the cost.
5. **Timezone defect.** Activity timestamps use `new Date(a.at).toISOString().slice(0,10)` — UTC, for a UTC+6 audience. Anything logged after 18:00 local displays yesterday's date. *(See A-0.8.)* — ✅ **Done** (P1 w1).
6. **Attention list is a fixed three.** The rules are hardcoded in `api.ts` with hardcoded thresholds (75%, past-due). Not configurable per institution. — ⬜ **Open**, P2. The thresholds are still literals in `api.ts`.
7. **`hasSubjects={false}` is hardcoded** in the `SetupChecklist` call — the checklist can never mark the subjects step complete. — ✅ **Done** (P1 w1, head-only count).
8. **No comparison or forecast.** No period-over-period delta, no collection forecast, no attendance seasonality — the analytical content a principal actually wants. — 🟡 **Partial** (P3 w11). The delta landed: the same fetcher runs over the preceding window **of equal length**, and the arrow renders only when that window has data — against a zero baseline every change is "+100%", which is the absence of a comparison rendered as a triumph. Forecast and seasonality are not built.
9. **EduSathi AI is absent from the dashboard.** The stated key differentiator has a rail entry and its own screen, and no presence on the surface every operator sees first. — ⬜ **Open**, and deliberately so. EduSathi v1 is Phase 4 week 15; a prompt bar shipped now would take a typed question to a screen that says "coming soon", which is the dead-control defect Phase 1 exists to have removed — on the daily habit surface, where it would annoy an operator every morning. It ships **with** the backend, in the same release, not before it.

**Why it is important.** The dashboard is the product's first impression, its daily habit surface, and — for the buyer — the demo. Items 2, 5 and 7 are correctness/quality defects on the highest-trust surface. Item 9 is a positioning failure: a differentiator that is not visible is not a differentiator.

**How it should be improved.** Add a period selector (This month / Last month / This term / This year / Custom) bound to `useQueryState` so the view is shareable; make KPI tiles navigate to their filtered list; centralise timestamp formatting on the institution timezone; move attention-rule thresholds into `institution_setting` with a Settings UI; fix `hasSubjects`; add period-over-period deltas once a second period exists; add a role-aware section set once A-0.4 lands; embed an EduSathi prompt bar ("Ask about your school") as a first-class dashboard element.

**Expected impact.** The dashboard becomes an analytical instrument rather than a status board; the differentiator becomes visible on day one; two data-correctness defects close.

> **P1 (period control, drill-down, timezone, `hasSubjects`, EduSathi surfacing) · P2 (customisation, forecasting) · Complexity M.**

---

## 3.2 A-2 · Students (`/admin/student/*` — 7 routes, 6 implementations)

| Route | Implementation | Capabilities *[matrix]* |
|---|---|---|
| `/registration` | `RegistrationScreen` (300 ln) | SaveBar only |
| `/update-basic` | `UpdateBasicScreen` (209 ln) | modal · empty · error · skeleton |
| `/update-class` | `UpdateClassScreen` (152 ln) | none |
| `/migration-merit`, `/migration-nomerit` | `MigrationRunner` (152 ln) | select · SaveBar · empty · error · skeleton |
| `/migration-pushback` | `MigrationPushbackScreen` (134 ln) | SaveBar · empty · error · skeleton |
| `/reports-summary` | `ReportsSummaryScreen` (241 ln) | export · empty · error · skeleton |

### A-2.1 Student Admission (`/registration`)

**What currently exists.** A four-card long form — Basic Info (7 fields), Class Placement (6), Guardian (7), Address (11 with cascading Division → District → Upazila lookups from the Bangladesh geo hierarchy, plus a "same as present" copy) — with a right rail for photo and three documents, a required-fields info strip, and a sticky SaveBar. It writes through `fn_register_student` (transactional), auto-generates the student code server-side, and correctly maps blood-group display values to DB tokens. Cascading selects properly clear their dependents.

**What is missing.**
1. **Photo and document upload are UI only.** The dropzone and the three "Upload" buttons are inert; the source comment says *"upload wired in a later pass."* A Supabase Storage bucket, an `fn_record_file_upload` RPC and an `institutionAssets` helper all already exist — this is unfinished wiring, not missing infrastructure. **ID cards cannot carry photos**, which is a downstream blocker for the Documents module.
2. **No duplicate detection.** Nothing checks for an existing student with the same name + DOB + guardian mobile. Duplicate admission records are the classic SIS data-quality failure and are painful to reconcile after fees and marks attach to both.
3. **No inline validation** (A-0.2), on the largest form in the product.
4. **No field-level format validation.** Birth registration number (17 digits), NID (10/17), and mobile (`01[3-9]XXXXXXXX`) are free text with only a placeholder hint.
5. **No draft/resume.** Losing 31 fields to a dropped connection (A-0.6).
6. **No roll-number assistance.** The field says "auto/manual" but offers no next-available suggestion and does not check for a collision within the section.
7. **No sibling linking.** Bangladeshi schools routinely enrol siblings; there is no way to reuse a guardian record, which fragments the parent account and duplicates guardian data.
8. **No admission-number series, no waiting list, no transfer-in flow** (a student arriving with a TC from another school has no distinct path).
9. **No post-save continuation.** On success the form resets to empty. There is no "view student / print ID / admit another / collect admission fee" branch — the operator is dropped back to a blank form with no record of what they just created.
10. **`grid-cols-3` is not responsive** on the inner field grids — no `sm:`/`md:` prefix, so three columns persist at 360px. This is the most layout-fragile screen in the product on a phone.

**Why it is important.** Admission is the entry point for every downstream record. Duplicates, malformed mobile numbers and missing photos propagate into fees, SMS delivery, ID cards and the parent app. Item 1 alone blocks a whole module. Item 9 breaks the operator's mental model of "did that work?".

**How it should be improved.** Wire uploads (drag-drop, client-side resize to ≤ 2 MB, progress, per-file error, delete) against the existing bucket + RPC; add a debounced duplicate check on name + DOB + guardian mobile with a "possible match" panel offering *view / merge / proceed*; add zod validation with BD-specific patterns and inline errors; add localStorage draft; add next-roll suggestion with collision check; add "link existing guardian" search; add a success state offering the four continuations; make the grids responsive. Consider splitting into a 4-step `Stepper` (the primitive exists, built for First-Login) with per-step validation — long single-page forms have measurably worse completion on constrained screens.

**Expected impact.** Duplicate rate → near zero. Admission time per student falls (roll suggestion, guardian reuse, draft resilience). The ID-card pipeline becomes possible. The screen becomes usable on the phone an office assistant actually carries.

> **P0 (uploads, inline validation, duplicate detection) · P1 (rest) · Complexity L.**

### A-2.2 Update Info / Class List / Reports / Migration

**Update Info (`/update-basic`)** — search-then-edit with a modal. Carries a permanently disabled Search button (A-0.3). *[matrix]* No URL state, no pagination, no export, no field-level history. **Missing:** a change-reason field and a per-student change timeline (the `audit_log` data exists; nothing surfaces it per record), bulk edit, and the same validation gap.

**Class List (`/update-class`)** — pick a section → roster with roll, guardian, DOB, contact. *[matrix]* **Zero** loading/empty/error states, no pagination, no export, no sort, no selection. This is a roster screen with none of the roster contract (A-0.1). **Missing additionally:** roll-number reordering, section transfer, class-teacher assignment, and a printable roster — all standard registrar tasks.

**Reports (`/reports-summary`)** — has CSV export, states, and skeleton. **Missing:** a report *builder*. It is one fixed summary; there is no field selection, no filter composition, no scheduling, no saved reports, no PDF, no charts. For "Insights" — a top-level IA zone — this is thin. A school's real reporting needs (enrolment by class/gender/category, attendance by month, fee ageing, result distribution) are unserved.

**Migration — With/Without Merit (`MigrationRunner`)** — source section → roster → select → `fn_run_migration` (transactional, set-based since the 2026-07-26 rewrite). Good: select-all with indeterminate state, source≠target refinement enforced in zod, an explicit destructive-action SaveBar.

> **F-5 · Merit rank is fabricated.** `merit_rank: isMerit ? idx + 1 : undefined` where `idx` is the index of the student in the **source roster as returned by the query** — i.e. roll order, not academic ranking. `result: "pass"` is hardcoded for every student. So "Migration — With Merit" produces a merit ordering unrelated to merit, and promotes failing students as passes.
> **Root cause:** the screen was built before `exam_result` was queryable and the placeholder was never revisited.
> **Risk:** academically invalid records in the students' permanent history; regulatory and reputational exposure; unrecoverable without a manual audit because the migration is transactional and leaves no pre-state.
> **Fix:** require an exam selection; order the roster by `exam_result.merit_rank`; derive `result` from `exam_result.result`; refuse to run if any selected student has no processed result for that exam; add a **dry-run preview** ("47 will promote to 10-A, 3 have no result, 2 failed") before the irreversible commit; write a `migration_batch` record that supports pushback (the pushback screen exists — connect them).
> **P0 · Complexity M · Impact: converts the most destructive operation in the product from unsafe to governed.**

Also missing across all three migration screens: no dry run, no per-student result/decision column, no capacity check against the target section, no fee-carryover handling, no notification to guardians, and a disabled Search button.

---

## 3.3 A-3 · Teachers & Staff (`/admin/teacher/*` — 3 routes, 2 implementations)

### A-3.1 Teacher Directory (`/list`) — **the reference screen**

**What currently exists.** Search (debounced 300 ms) · department filter from a **server-side distinct list** (explicitly not derived from the current page, which would silently shrink the filter as you page) · sortable name and status columns · pagination at 20 · row selection that is **page-aware** (select-all means "all on this page", correctly, when selection spans pages) · bulk SMS handoff via `?recipients=` · export-this-page **and** export-all (a second bounded fetch) · a `LiveRegion` announcing result counts · per-row `RowActions` · skeleton rows matching the real column count · retryable error state · and **all of it in the URL** via `useQueryState`, so the view is bookmarkable, shareable and back-button-safe. Server-prefetched and hydrated.

This screen is the product's proof that the team can build to enterprise standard. **The gap is that it was built once.**

**What is missing.** Column visibility/reorder; saved views ("my department, active only"); an inline detail drawer (row actions navigate away, losing context); bulk actions beyond SMS (deactivate, assign department, export selection); a photo column; last-login/activity; subject-load and class-teacher assignment summary; and — notably — the row action "Edit profile" links to `/admin/teacher/update-profile` **without an id**, so it opens the generic update screen rather than that teacher's record.

> **P1 · Complexity S–M.** The missing id on the edit link is a **P0/S** correctness bug: the action does not do what its label says.

### A-3.2 Teacher Onboarding & Profiles (`TeacherForm`, 416 lines)

Serves both `/registration` and `/update-profile`. *[matrix]* SaveBar only — no skeleton, no empty, no error state, and no inline validation across what is the second-largest form in the product.

**Missing (HR-domain):** employment record (join date, employment type, contract end), salary/payroll fields, qualification and certification records with document upload, subject-competency mapping (which feeds timetabling and marks-entry authorisation), leave balance and history, performance/appraisal, emergency contact, and separation workflow. Today a "teacher" is a directory entry, not an employee record. **There is no HR module**, and for institutions above ~30 staff that is a purchase objection.

**Also missing:** no id in the update-profile route (see above), no duplicate detection on mobile/NID, no bulk import, no photo.

---

## 3.4 A-4 · Attendance (`/admin/attendance/*` — 6 routes, 3 implementations)

`AttendanceMarker` serves four routes (section/exam take + both updates); `ReportScreen` and `AnalyticsScreen` are their own.

**What currently exists.** Section + date (+ exam) selection; roster from `useSectionStudents`; hydration of existing marks with a default of *present*; four context-appropriate statuses (daily: present/absent/late/leave; exam: adds exam-absent) as tinted pills; a "সবাইকে উপস্থিত / All present" bulk action; a live summary of counts in the SaveBar; an SMS-to-absentees' guardians toggle; transactional save via RPC; empty/error/skeleton states throughout; and a partitioned `attendance` table with the partition key set at the write path.

**What is missing.**
1. **A permanently disabled Search button** (A-0.3) at the top of the primary flow.
2. **No indication that attendance was already taken.** Existing marks hydrate silently. The operator cannot tell "I am creating today's record" from "I am overwriting it" — on a screen with an SMS side effect. There is no `taken_at`/`taken_by` display and no warning.
3. **No calendar/holiday awareness.** Weekends, government holidays and institution holidays are not modelled. Attendance can be taken on Eid; the 30-day average on the dashboard is diluted by non-teaching days; and there is no academic-calendar screen anywhere in the product.
4. **No period/subject-wise attendance.** Only whole-day. Secondary schools in this market increasingly require period-wise.
5. **No SMS preview or cost estimate** beside a toggle that spends real money — and no visibility of what the message says.
6. **No keyboard flow.** No arrow navigation, no numeric shortcuts (1=present, 2=absent), no type-ahead by roll (A-0.7). Marking 60 students is 60 mouse clicks.
7. **No late-entry policy.** Backdated attendance is unrestricted and unflagged.
8. **No bulk patterns:** cannot copy yesterday, cannot mark a whole section on leave for an event.
9. **Report and Analytics screens have no export, no pagination, no URL state, no date-range presets** *[matrix]* — and no per-student drill-down, no chronic-absentee list, no comparison across sections, and no printable monthly register (the artefact schools are legally required to keep).
10. **No offline capability**, despite the auth screen advertising *"অফলাইন উপস্থিতি / Offline attendance"* as a headline feature. This is a **marketing-vs-product mismatch** that will be tested in the first demo.

**Why it is important.** Attendance is the highest-frequency operation in the entire system — once or more per section per day, every teaching day. Its ergonomics dominate perceived product quality more than any other screen. Items 2 and 5 attach real money and real parent messages to an ambiguous action; item 3 corrupts every attendance statistic the product reports; item 10 contradicts the product's own advertising.

**How it should be improved.** Remove the dead button; render a clear "Attendance for 12 Feb already recorded by Rahim at 09:14 — you are editing it" banner with an overwrite confirmation; build an Academic Calendar (Settings) with holidays and non-teaching days, exclude them from statistics and refuse attendance on them by default; add `useGridNavigation` with numeric shortcuts; show the SMS template and a recipient/segment/cost preview before save; add copy-yesterday and mark-section-on-leave; give Report/Analytics the full A-0.1 contract plus a printable monthly register; and either build offline support (service worker + IndexedDB queue + reconciliation) or **remove the claim from the auth screen** until it is true.

**Expected impact.** Marking time per section falls from minutes to well under one; attendance statistics become defensible; the SMS spend becomes visible before it is incurred; the product stops making a claim it cannot demonstrate.

> **P0 (dead button, already-taken indicator, SMS preview, offline claim) · P0/P1 (grid navigation, holidays) · P1 (rest) · Complexity M–L; offline is XL.**

---

## 3.5 A-5 · Exam & Results (`/admin/exam/*` — 10 routes, 5 implementations)

| Implementation | Serves | Notes |
|---|---|---|
| `ExamSettingsTab` | `/settings` | Exam create/manage |
| `ConfigTab` (generic) | `/mark-config`, `/marksheet-config`, `/comment-config`, `/date-config` | Renders a jsonb config as typed fields |
| `MarksEntry` | `/mark-input`, `/mark-update` | The marks grid |
| `ResultProcessor` | `/result-process`, `/result-sheet-download` | Process + view |
| `MarkProcessScreen` | `/mark-process` | |

### A-5.1 Marks Entry — the highest-stakes data-entry screen in the product

**What currently exists.** Exam + section + subject + full-marks selection; roster; hydration of existing marks; a per-student numeric input with `min`/`max` bound to full marks; an absent checkbox that clears and disables the mark; transactional bulk save through an RPC; empty/error/skeleton states; a SaveBar showing the student count.

**What is missing.**
1. **Full marks is a free-text field defaulting to `"100"`.** The exam's own `mark_config` (there is a whole configuration screen for it) is not consulted. An operator can enter 100 for a subject configured at 50, and the resulting GPA is wrong for the entire section with nothing to catch it.
2. **No component marks.** Bangladeshi secondary assessment is split (written / MCQ / practical / CA), each with its own full marks and pass rule. This screen models a single number. **This is a domain-model gap, not a UI gap**, and it is the most significant functional omission in the academic core.
3. **No validation feedback.** `max` on the input is browser-level only; a pasted or programmatically-set value above full marks is accepted and saved.
4. **No keyboard grid navigation** — 60 students, 60 Tab presses (A-0.7).
5. **No import.** Teachers keep marks in Excel. There is no CSV path in or out.
6. **No draft/autosave** — a 45-minute session is one disconnect from gone (A-0.6).
7. **No concurrency control** — two teachers on the same subject silently overwrite (A-0.6).
8. **No entry-progress view.** Nothing shows which subjects/sections are complete, which is exactly what an exam controller needs during the entry window.
9. **No lock/submit workflow.** Marks are editable indefinitely by anyone with access; there is no "teacher submits → controller verifies → locked" chain, despite `exam.status = 'locked'` existing in the schema and being read by the dashboard.
10. **No moderation/scaling, no absent-vs-zero distinction in reporting, no re-mark request path.**

**Why it is important.** Marks are the most consequential records a school holds. Item 1 silently miscalculates GPA. Item 2 means the product cannot represent the national assessment structure. Items 6, 7 and 9 mean marks can be lost, silently overwritten, or altered after publication with no control. For an academic-defence context specifically, item 2 is the finding an examiner will pursue.

**How it should be improved.** Derive full marks (and component structure) from `mark_config` per subject/exam and make it read-only in the grid; extend the schema and RPC to component marks with per-component full/pass; add zod + inline per-cell error; build `useGridNavigation`; add CSV import/export with the shared `<ImportWizard>`; autosave drafts; add `updated_at` optimistic concurrency; add an entry-progress matrix (subject × section, colour-coded); implement submit → verify → lock with role gates (depends on A-0.4) and audit entries.

**Expected impact.** Entry time per section falls sharply; GPA correctness becomes structural rather than dependent on operator care; the product becomes able to represent the actual national assessment model; marks acquire a governed lifecycle.

> **P0 (full-marks derivation, validation, autosave, lock workflow) · P0 domain (component marks) · P1 (rest) · Complexity L–XL.**

### A-5.2 Result Processing & Result Sheet

**What currently exists.** Exam selection → `fn_process_exam_result` (GPA, grade, merit rank computed set-based in Postgres — the right place); a read-only result table with merit, ID, name, total, GPA, pass/fail; a section filter on the view mode; a print path using `window.print()` against a real `print.css` that yields a clean sheet with repeating headers and no chrome (a genuinely good, dependency-free decision).

**What is missing.** No publish workflow (process ≠ publish; nothing gates parent visibility); no grade distribution or statistics (pass rate, subject-wise averages, highest/lowest — the analysis a head teacher wants immediately); no tabulation sheet (subject × student matrix, the artefact schools actually produce); no individual marksheet/report card output despite a `marksheet-config` screen existing to configure one; no comparison across exams; no re-processing safeguard (what happens to published results if marks change and process is re-run?); no export beyond print; no pagination on the results list; no position-within-section vs. within-class distinction.

**Why it is important.** The Documents module configures a marksheet that the Exam module cannot produce. Result publication — the single most anticipated event of a school term for parents — has no controlled release. Re-processing after publication is an unguarded data-integrity hazard.

**How it should be improved.** Add process → verify → publish with an explicit parent-visibility gate and an audit entry; block re-process on a published exam without an explicit "unpublish and reprocess" confirmation that notifies affected parents; build the tabulation sheet and the individual marksheet against `marksheet_config` using the proven print-CSS approach; add a statistics panel; add CSV/Excel export.

> **P0 (publish gate, re-process guard) · P1 (tabulation, marksheet, statistics) · Complexity L.**

### A-5.3 Exam Configuration (4 screens via `ConfigTab`)

**What currently exists.** A generic driver that loads a jsonb config singleton, renders typed fields (text/number/toggle) from a declarative field list, and saves via `fn_save_exam_config`. Elegant, DRY, and it made four screens out of one component.

**What is missing.** Everything the genericity costs: no per-field validation or constraints; no field help text explaining what a setting *does*; no defaults/reset-to-default; no preview of the effect (a marksheet config with no marksheet preview is guesswork); no versioning or change history on settings that alter how results are computed; no dependency validation between configs (a mark config and a grading scheme that disagree are silently accepted); and toggles built as `<button>` inside `<label>` (A-0.7).

> **P1 · Complexity M.** Add per-field `help`, validation, defaults, a live preview panel for the marksheet/comment configs, and settings history via `audit_log` (the coverage already exists — it needs a UI).

---

## 3.6 A-6 · Fees & Finance (`/admin/fee/*` — 8 routes, 8 implementations)

The most operationally sensitive module, and the one with the widest quality spread — from **Delete Fees** (the best destructive-action UX in the product) to **Quick Collection** (missing the artefact the transaction exists to produce).

| Route | Capabilities *[matrix]* | Headline gap |
|---|---|---|
| `/quick-collection-list` | empty · error · skeleton | No URL state, sort, export, pagination |
| `/quick-collection-form` | empty · error · skeleton | **No receipt** |
| `/digital-collection` | pagination · export · states | No reconciliation, no gateway |
| `/unpaid-section` | export · states | Disabled primary button |
| `/unpaid-institute` | export · states | Disabled primary button |
| `/income-statement` | export · error · skeleton | Hardcoded bilingual headers; negative net rendered as credit |
| `/fee-mapping` | states | No preview of who is affected |
| `/delete-fees` | pagination · selection · typed confirm · states | **Exemplary** |

### A-6.1 Quick Collection (form) — collect a payment

**What currently exists.** Student lookup by code (Enter-to-search) with a `?student=` deep link; a profile panel (name, ID, roll, section, father, mobile); payment method and account selection; a per-invoice row showing fee heads, period, total, due, an amount input defaulting to the full due, and a Collect button; running totals for paid and due; zod-validated collection through `fn_collect_fee` with a fixed double-ledger bug in its history; `amountString` in the shared validation layer specifically rejects `"1,200"` because that is how a Bangladeshi clerk types twelve hundred taka.

**What is missing.**
1. **No receipt.** The transaction completes with a toast. There is no receipt number surfaced, no printable receipt, no SMS confirmation to the guardian, no reprint path. **A fee-collection screen that does not produce a receipt is not usable at a cash counter** — the parent will not leave without paper, so the clerk maintains a parallel manual book, and the system's ledger and the school's ledger diverge from day one. This is the single highest-impact functional gap in the module.
2. **Collect is per-invoice.** A parent paying ৳5,000 against three invoices requires three transactions, three ledger entries, and no single payment record. Real-world payments are one amount allocated across dues.
3. **No over/under-payment handling.** No client-side guard that the amount ≤ due (the input has `min={0}` and no `max`); no advance/credit balance concept; no change calculation.
4. **No discount or waiver at the point of collection**, despite `waiver_amount` existing on `fee_invoice`. Waivers are common (siblings, hardship, merit) and there is no way to apply one where the decision is actually made.
5. **No reversal or void.** A mistyped amount is permanent. Delete Fees voids *invoices*, not *payments*.
6. **No idempotency.** A double-click or a retry on a flaky connection can post twice; nothing carries a client-generated idempotency key.
7. **No offline mode** at a counter that is often the first place the connection drops.
8. **No day-book / cash-drawer close.** No end-of-day reconciliation per collector, which is the control that makes cash handling auditable.
9. **No student search by name** — code only. A parent arriving without the ID number cannot be served.

**Why it is important.** This screen handles money in a cash-dominant market. Items 1, 5, 6 and 8 are the four controls that make cash collection auditable, and none exists. The absence of a receipt guarantees a parallel paper system, which guarantees reconciliation disputes.

**How it should be improved.** Generate and display a receipt number on success; render a print-CSS receipt (thermal-width and A5 variants) with institution letterhead from `institution_setting` and the signature asset that already has a Settings screen; send an SMS confirmation when the gateway lands; allow a single payment allocated across selected invoices with automatic oldest-first allocation and manual override; add `max`-bound amounts with an explicit advance-payment path; add waiver entry with a reason and a role gate; add void-with-reason writing a reversing ledger entry (never a delete); add an idempotency key to `fn_collect_fee`; add name/mobile search; add a day-book screen with per-collector totals and a close-of-day lock.

**Expected impact.** The cash counter becomes operable without paper. Collections become auditable and reversible. The double-posting class of defect is closed structurally.

> **P0 (receipt, idempotency, void, over-payment guard) · P1 (multi-invoice allocation, waiver, day-book, name search) · Complexity L.**

### A-6.2 The rest of the module

**Quick Collection (list)** — *[matrix]* states only. No URL state, sort, pagination, export, or date filter on what is a transaction log. Needs the full A-0.1 contract, plus per-collector and per-method filters.

**Digital Collection** — paginated with export and an aggregate stats RPC (a client-side full scan was correctly replaced). **Missing:** the gateway itself. There is no bKash/Nagad/SSLCommerz integration, no webhook handler, no reconciliation view (gateway settlement vs. recorded transaction), no refund path, no failed/pending state machine. The screen reports on transactions the product cannot yet create.

**Unpaid (Section) / Unpaid (Institute)** — export and states; the section filter was correctly pushed into the query after a real correctness bug (client-side filtering past PostgREST's row cap silently under-reported debt). **Missing:** disabled primary buttons (A-0.3); no ageing buckets (0–30 / 31–60 / 61–90 / 90+), which is the standard receivables view and the basis of any collection strategy; no bulk reminder action into SMS; no pagination on Institute (a whole-institution list); no per-student drill-down.

**Income Statement** — date range with an explicit, correct Search trigger; a three-ledger layout (Income / Expenditure / Profit-Loss); CSV export. **Missing:** hardcoded bilingual column headers bypassing `useT` (`"খাত / Head"`, `"ডেবিট / Debit"`, `"ক্রেডিট / Credit"`) — the i18n system leaking (A-0.8); a negative net is rendered in the *credit* column with no sign treatment, so a loss reads as income; no period presets (this month / last month / this term / FY); no comparison period; no drill-down from a head to its transactions; no chart; no PDF; and — structurally — **there is no expense-entry screen anywhere in the product**, so the Expenditure ledger can only ever be empty unless expenses arrive by another route. An income statement with no expense capture is a half-built accounting module.

**Fee Mapping** — states only. **Missing:** no preview of how many students a mapping affects before it applies (this creates invoices — it is a bulk write with no dry run); no effective-date/versioning; no per-student override; no bulk mapping by category; no history.

**Delete Fees** — **keep as the reference.** Paginated, multi-select with selection deliberately surviving page changes (documented, correct), a running selected-total, and a `DangerConfirm` requiring the operator to **type the count** with a preview of up to 8 affected records. This is exactly the right weight for an irreversible institution-wide write. **Missing only:** a mandatory reason field and a void-log view.

---

## 3.7 A-7 · Documents / Certificates (`/admin/certificate/*` — 7 routes, 4 implementations)

| Implementation | Serves |
|---|---|
| `TemplateManager` | `/template` |
| `BatchCreator` | `/id-card`, `/admit-card` |
| `SettingConfig` | `/admit-instruction`, `/exam-essentials` |
| `CertRecordForm` | `/testimonial`, `/transfer` |

**What currently exists.** Batch creation for ID cards (class, section, roll range, card type, class colour, validity) and admit cards (exam, class, section, roll range, centre, issue date), each writing through `fn_create_*_batch`; a recent-batches list; template header/body configuration; certificate record creation for testimonials and transfer certificates with a student lookup by code; empty states.

**What is missing — and this is the module's defining problem.**
1. **No output.** Both output buttons are disabled and labelled "(soon)" (A-0.3). The module creates *records of documents* and produces **no document**. Seven screens, zero artefacts.
2. **No preview.** The operator configures a card with no idea what it will look like.
3. **No template designer.** "Card type" and "Class colour" are **free-text inputs** (`placeholder="Standard"`, `placeholder="Blue"`). There is no template selection, no colour picker, no layout options, no logo/signature placement. Whatever the operator types is stored as an uninterpreted string.
4. **Photos are unavailable** because Registration's upload is unwired (A-2.1). An ID card without a photo is not an ID card.
5. **No QR/barcode**, despite `includes: { qr: true }` being hardcoded in the payload with no way to configure or render it.
6. **No verification path.** Transfer certificates and testimonials are legal-adjacent documents; there is no serial register, no verification URL, no tamper-evident record.
7. **No signature integration** despite a Signature settings screen existing.
8. **No batch history detail** — the list shows class and roll range only; no created-by, no date, no count, no reprint, no cancel.
9. **No student selection** other than a roll range — cannot exclude, cannot pick individuals, cannot handle a student who joined mid-range.

**Why it is important.** In this market, ID cards and admit cards are frequently the **purchase trigger**: they replace a recurring outsourced printing cost with a fixed software cost. A module that configures them but cannot print them delivers the administrative burden without the payoff, and is the most likely single reason a pilot fails to convert.

**How it should be improved.**
1. Build a **document rendering layer** on the print-CSS approach already proven by the Result Sheet — no PDF dependency needed for print. Templates: ID card (CR80, 2-up and 8-up sheets), admit card, testimonial, transfer certificate, marksheet.
2. Replace free-text template/colour with a template picker rendering live thumbnails, plus a small set of themes with a colour token selection.
3. Add a preview pane bound to a real sample student.
4. Wire photos (A-2.1) and the signature asset.
5. Add QR encoding a verification URL; add a public verification endpoint and a serial register for certificates.
6. Add individual/multi student selection alongside roll range, with exclusions.
7. Add batch detail: created-by, created-at, count, reprint, cancel-with-reason.
8. Reach for server-side PDF (a headless renderer) only for archival/signed copies, and treat it as a later, separable phase.

**Expected impact.** Turns seven configuration screens into a delivered capability. Removes the most likely pilot-to-purchase blocker in the product.

> **P0 · Complexity XL (rendering layer) + M (each template) · Impact: highest commercial leverage of any single item in this report.**

---

## 3.8 A-8 · Communication (`/admin/sms-notice/*` — 5 routes, 5 implementations)

### A-8.1 Send SMS — **contains F-2, a live billing defect**

**What currently exists.** Recipient type (parents/students/teachers); a group field; language; template selection that populates the body; a message textarea; a character and segment counter; balance display; a `?recipients=` handoff consumer that makes the Teacher Directory's bulk action real (a genuine fix — the parameter was previously written and never read); zod validation with `recipient_count ≥ 1` after a live billing bug where an empty count billed zero and reported nothing; an honest info strip stating that delivery activates after gateway integration.

**What is missing.**

> **F-2 (a) · The recipient count is typed by hand.** `Field label="প্রাপক সংখ্যা (আনুমানিক) / Recipient count (est.)"` is a free numeric input the operator fills in, and it is what the balance is debited by. The system knows exactly how many parents are in section 9-A — it has the roster — and asks the operator to guess. Any typo is a direct billing error in either direction, and the recorded campaign size is fiction.
>
> **F-2 (b) · Segments are counted with the wrong alphabet.** `const segments = Math.max(1, Math.ceil(chars / 160))`. GSM-7 is 160 characters per segment; **Bangla is UCS-2 at 70 characters (67 when concatenated)**. A 150-character Bangla notice — an entirely ordinary length — displays as **1 segment** and actually costs **3**. Every Bangla campaign in a Bangla-first product is under-counted by roughly 2.3×.
>
> **F-2 (c) · The recipient group is free text.** `placeholder="যেমন: ৯ম-ক / e.g. 9-A"` — a string, not a section reference. Nothing resolves it to actual recipients.
>
> **Root cause:** the screen was built against a gateway that does not exist, so the parts that would come *from* the gateway (recipient resolution, real segment counting, delivery receipts) were stubbed with operator input and never revisited.
> **Business impact:** the institution is billed, and bills parents, against numbers nobody computed. In a product whose SMS balance is a purchased commodity, this is a direct financial-accuracy defect.
> **Fix:** replace the count input with a **recipient resolver** — pick class/section/category/individual, resolve against the roster, show the real count and the list; compute segments with encoding detection (`/[^ -]/` → UCS-2 70/67, else GSM-7 160/153) and display encoding, segments, per-message cost and total cost before send; reserve balance atomically at send time from the resolved count, not the typed one.
> **P0 · Complexity M · Impact: closes a live billing defect and makes the module's core action truthful.**

**Also missing:** no gateway integration (the module's reason for existing); no scheduling; no delivery receipts or per-recipient status; no opt-out/consent management (a regulatory exposure when messaging guardians of minors); no personalisation tokens (`{{student_name}}`, `{{due_amount}}`) despite templates existing; no test-send; no approval workflow for institution-wide sends; no throttling; no unicode/transliteration preview; no cost centre attribution.

### A-8.2 Notice Board · Templates · History · Balance

**Notice Board** — paginated with empty states. **Missing:** rich text, attachments, scheduling, expiry, targeting by audience, publish/unpublish workflow, and any connection to the parent app (a notice board nobody reads is a database table).

**Templates** — empty state only. **Missing:** categories, variables/personalisation tokens, character/segment preview per template, approval, usage analytics, versioning.

**History** — paginated with export and states. **Missing:** per-recipient delivery status (impossible without a gateway), failure reasons, retry, cost per campaign, filtering by date/type/sender, and a spend chart.

**Balance & Purchase** — skeleton and empty states. **Missing:** actual purchase (no payment integration), low-balance alerting, auto-recharge, consumption trend, per-module attribution (attendance SMS vs. fee reminders vs. campaigns), and invoices/receipts for purchases.

---

## 3.9 A-9 · Core Settings (`/admin/core/*` — 9 routes, 9 implementations)

| Screen | Capabilities *[matrix]* | Assessment |
|---|---|---|
| Basic Config | SaveBar · skeleton | Good — institution profile, session, week start, working days, language, currency, date format, number system |
| StartUp | SaveBar · skeleton | Good |
| Class Config | empty | Thin — no states |
| Signature | none | Thin — no states |
| Subject List | modal · empty | Reasonable |
| Subject Group | modal · empty | Reasonable |
| Grading Scheme | modal · empty | Good — see below |
| User List | pagination · export · states | **Read-only — see A-0.4** |
| Audit Log | pagination · modal · error | Good foundation — see below |

### A-9.1 Grading Scheme

**What currently exists.** Multiple named schemes with a default flag; a scheme selector; a scale table (grade letter, mark range, GPA point, remark) sorted descending by minimum marks; derived pass-mark and max-GP indicators; a modal editor with add/remove rows; a `ConfirmDialog` on delete; sensible GPA-5 defaults matching the Bangladeshi standard.

**What is missing.** **No range validation** — nothing prevents overlapping ranges (A+ 80–100, A 75–85), gaps (nothing covers 70–72), or a scale that does not span 0–100. Because this table drives `fn_process_exam_result`, an invalid scheme produces silently wrong grades for an entire cohort. Also: no per-class or per-subject scheme assignment (a scheme is institution-wide); no effective-date versioning, so editing a scheme retroactively changes historical results; no preview against sample marks; no scheme duplication; and the per-row pencil icon opens the whole-scheme modal rather than that row, which is a control/label mismatch.

> **P0 (range validation — it is a silent correctness hazard) · P1 (versioning, per-class assignment) · Complexity S / M.**

### A-9.2 Audit Log

**What currently exists.** Paginated, entity-filtered, with before/after JSON in a modal, action-toned badges, actor name, append-only enforcement and trigger coverage at the database level. The foundation is right.

**What is missing.** No date-range filter (the most common audit query); no actor filter; no free-text search; no export (a compliance requirement, not a convenience); a raw `JSON.stringify` diff rather than a field-level rendering, so a one-field change requires reading two JSON blobs side by side; `toLocaleString()` on timestamps (browser timezone, not institution timezone — see A-0.8); no retention policy or archival; no IP/user-agent capture; no coverage indicator telling an auditor *which* entities are actually logged; and no alerting on sensitive events (role change, bulk delete, result publication).

> **P1 · Complexity M.** Add date/actor/search filters, CSV export, a field-level diff renderer, institution-timezone formatting, and a retention/archival policy.

### A-9.3 The settings module as a whole

**Missing screens the product needs and does not have:** Academic Calendar (terms, holidays, non-teaching days — see A-4); Fee Structure/Heads (fee mapping exists but head definition does not surface); Notification Preferences (which events trigger SMS, per role); Integration Settings (gateway credentials, once they exist); Backup & Export (institution data export — a data-portability expectation and, increasingly, a legal one); Branding (logo, colours, letterhead — currently partial); Data Retention. Also missing across the module: no settings search (9 tabs of dense configuration with no way to find "week start day"), no change history surfaced per setting, no import/export of configuration for multi-campus operators, and no validation that interdependent settings agree.

---

## 3.10 A-10 · EduSathi AI (`/admin/edusathi`)

**What currently exists.** A 92-line screen with an empty state. It is the product's stated key differentiator and appears in the rail with an accent treatment, on the auth screen's feature list, and in the profile menu's Help item.

**What is missing.** The feature. There is no conversational interface, no model integration, no data grounding against the institution's own records, no Banglish handling, no suggested prompts, no history, no citation of the records an answer came from, no permission scoping (an assistant that can read anything is a data-exfiltration surface), no rate limiting, no cost controls, and no evaluation harness.

**Why it is important.** Product memory records an explicit decision (2026-07-25) that **EduSathi AI is the key differentiator and must be prominently featured across UI/UX and documentation, framed as an assistant/copilot rather than predictive ML**. Today the product *advertises* it in three places and *delivers* an empty state. In an academic defence, "what makes this different from the existing systems" will be asked directly, and this screen is the answer.

**How it should be improved (a coherent minimum viable differentiator).**
1. **Grounded Q&A over the institution's own data.** "Which students in 9-A have below 70% attendance and unpaid fees?" answered by generating a *parameterised, RLS-scoped query* against a curated schema view — never free-form SQL — and rendering the result as a table with a "show me the rows" link into the relevant admin screen.
2. **Permission inheritance.** The assistant executes as the calling user under RLS. It can never see what the user cannot. This is the security-architecture requirement and it is satisfiable for free because RLS already covers 86/86 tables.
3. **Bangla + Banglish input**, with the answer in the operator's active locale.
4. **A dashboard prompt bar** so the differentiator is on the surface every operator sees first (A-3.1 item 9).
5. **Suggested prompts** derived from the current screen's context.
6. **Audit every query**, show the records an answer used, and rate-limit per institution with a visible quota.
7. **Explicit scope boundary:** an assistant that *reads and explains*, never one that writes. Writes stay behind the governed RPC surface.

**Expected impact.** Converts the product's stated differentiator from a claim into a demonstrable capability, using data-access controls that are already built. This is the highest-value item for the academic-defence and sales narratives, and — because RLS does the hard part — a smaller build than it appears.

> **P0 (for positioning) · Complexity XL · Impact: this is the product's answer to "why you".**

---

# 4. Part B — Authentication module redesign

## 4.1 Honest assessment of the current state

The brief describes the authentication screens as *"outdated in visual design, colour palette, layout, user experience, modern design principles, accessibility and responsiveness."* **The evidence does not support that as a whole**, and saying so is more useful than agreeing.

The auth module was rebuilt against the Figma reference and it is, visually, one of the better-executed surfaces in the product. `AuthShell` is a split-panel layout (44% indigo brand rail / 56% form column) that collapses cleanly to a single column below `lg`, with a compact mobile brand lockup, locale and theme toggles always visible on the auth canvas, a token-driven card, and full light/dark support. Login has mobile-or-email identification (matching how Bangladeshi parents actually log in), remember-me, show/hide password, a forgot-password link, an OTP alternative, `role="alert"` error copy, honest loading states, `autoComplete="username"`/`current-password`, a safe-internal-redirect guard that rejects external destinations, and — a detail most products get wrong — a **429 rate-limit classifier** so a throttled user is told to wait rather than told their password is wrong. `OtpInput` is a real segmented input with auto-advance, backspace and paste. `Stepper`, `PasswordInput` and `Checkbox` are design-system primitives.

**So the accurate finding is not "the visuals are dated". It is: the module looks finished and is functionally incomplete, which is a worse problem, because it is invisible until tested.** Four of the seven flows either do not work, do not exist, or actively mislead.

## 4.2 Screen-by-screen

| Screen | Route | State | Verdict |
|---|---|---|---|
| Role Selection | `/` | `RoleSelect` component | Works; drives header copy only, JWT role is authoritative (correct) |
| Login | `/login` | 170 ln, live | **Strong** — see above |
| OTP Verification | `/otp` | 110 ln | **Non-functional by design** — no SMS provider; honestly says so |
| Forgot Password | `/forgot-password` | 103 ln, live | Works (Supabase reset email) |
| Reset Password | `/reset-password` | 200 ln, live | Works |
| Change Password | `/change-password` | 134 ln, live | Works |
| First-Login Setup | `/first-login-setup` | 136 ln | Present; onboarding stepper |
| **Multi-Factor Auth** | — | **Does not exist** | **Missing** |
| **Session Management** | — | **Does not exist** | **Missing** |
| **Account Lockout / security events** | — | **Does not exist** | **Missing** |

## 4.3 Findings

### B-1 · OTP sign-in is advertised and does not work — **P0**
**Problem.** `/login` renders a prominent secondary CTA, *"ওটিপি দিয়ে লগইন করুন / Sign in with OTP"*. Following it produces a fully-styled 6-digit input, a 30-second resend timer, and — on submit — the message *"OTP sign-in isn't available yet."* The prior audit removed a genuinely dangerous version of this screen (any six digits "succeeded" and routed to `/admin/dashboard`) and replaced it with honesty, which was right. But the **entry point was never removed**, so the product still invites users into a dead end.
**Root cause.** No SMS provider is contracted. The screen shipped ahead of its dependency.
**Risk / impact.** Every first-time parent and teacher — the users least able to recover — is offered the wrong door. In a demo, it is the first thing an evaluator clicks.
**Recommendation.** Gate the CTA behind a runtime capability flag (`NEXT_PUBLIC_OTP_ENABLED`) defaulting to off; keep the screen (its input, timer and error shape are already the right shape for `supabase.auth.verifyOtp({ phone, token })`). Ship the provider integration and flip the flag in the same release.
**Complexity S** (flag) **+ M** (provider). **Impact:** removes the most visible broken promise in the product.

### B-2 · No multi-factor authentication — **P0 for institutional sale**
**Problem.** A single password protects an account that can read every student's personal data, every guardian's phone number, every fee balance, and can irreversibly promote or void records for a whole institution.
**Root cause.** MFA was never scoped; the auth work stopped at parity with the Figma screens.
**Risk.** Credential stuffing and shared-password practice are endemic in school offices. One compromised admin account is a full-institution data breach involving minors.
**Business impact.** MFA is a standard line item on institutional security questionnaires. Its absence is a procurement blocker at any buyer with an IT function, and a defensibility problem for a system holding children's data.
**Recommendation.** Supabase Auth ships TOTP MFA (`auth.mfa.enroll/challenge/verify`) — this is configuration and UI, not cryptography.
- Enforce MFA for `super_admin` and `admin`; optional for `teacher`; not for parents.
- Enrolment: QR + manual secret, verify-before-enable, **10 single-use recovery codes** shown once with a download/print action.
- Challenge: after password success, a 6-digit step using the existing `OtpInput`, with "trust this device for 30 days" backed by a signed device token.
- Management: view enrolled factors, regenerate recovery codes, unenrol with password re-authentication.
- Admin recovery: a `super_admin` can reset another user's MFA, and that action is a high-severity `audit_log` event.
**Complexity M.** **Impact:** closes the single largest security gap and a named procurement blocker.

### B-3 · No session management — **P1**
**Problem.** A user cannot see where they are signed in, and cannot revoke a session. `remember` on the login form is decorative — the source comment states plainly that `@supabase/ssr` persists the session in cookies regardless. There is no idle timeout, no absolute session lifetime, no re-authentication before sensitive actions.
**Risk.** A session on a shared school computer persists indefinitely. A user who suspects compromise has no action available except changing their password, and even that does not visibly kill other sessions.
**Recommendation.** Add **Settings › My Account › Security**: active sessions (device, browser, approximate location, last active, current-session marker) with per-session and all-other-sessions revoke; a security-event log (sign-ins, password changes, MFA changes, failed attempts); an idle-timeout warning modal at 25 minutes with a "stay signed in" extension and sign-out at 30 (configurable per institution); step-up re-authentication before role changes, bulk destructive actions and MFA changes; and make `remember` real by writing a session-scoped cookie when it is off.
**Complexity M–L.** **Impact:** meets the baseline expectation for a system holding minors' records.

### B-4 · No self-service account screen — **P1**
**Problem.** The profile menu's **প্রোফাইল / Profile** item links to `/admin/core/user-list` — a **list of every user in the institution**, not the signed-in user's own account. There is no screen where a user updates their own name, phone, email, photo, language preference, theme preference or notification preferences.
**Root cause.** The menu item was wired to the nearest existing route.
**Recommendation.** Build **My Account** (`/admin/account`) with tabs: Profile · Security (B-2, B-3) · Preferences (language, theme, density, default landing screen) · Notifications. Re-point the menu item.
**Complexity M.** **Impact:** fixes a mislabelled navigation action and provides the natural home for MFA and sessions.

### B-5 · Password policy is invisible and unenforced client-side — **P1**
**Problem.** No strength meter, no stated requirements, no breach check surfaced. Supabase's leaked-password protection is **still the one open security advisory on the project** (an owner toggle, ~30 seconds).
**Recommendation.** Enable leaked-password protection; render requirements as a live checklist (length, character classes, not-a-known-breach) on Reset/Change/First-Login; add a strength meter; add an expiry policy for admin roles if the institution requires it; never expose whether an email exists on Forgot Password (verify the current copy is neutral).
**Complexity S.**

### B-6 · Role Selection is cosmetic and can mislead — **P2**
Selecting "Parent" and then signing in with an admin credential lands the user in `/admin` (correct — the JWT is authoritative) after a screen that told them they were signing in as a parent. Either drop the role step and route purely from the JWT, or keep it and, on mismatch, show *"This account signs in as Administrator"* before redirecting.

### B-7 · Missing states — **P1**
Across the seven auth screens there is no **success** state (Forgot Password should show a distinct "check your messages" screen with the masked destination and a resend timer, not a toast), no **empty** state, no **expired-link** state on Reset (a stale recovery token currently produces a generic error), no **account-locked** state, and no **offline** state. `AuthShell` has no branded skeleton for the auth-check moment.

## 4.4 Target design direction

Keep the split-panel architecture and the token system — both are correct and already shipped. The redesign is **depth, motion and completeness**, not a repaint:

| Aspect | Direction | Status (P3 w11) |
|---|---|---|
| **Brand rail** | Keep the indigo field. Add a subtle animated gradient mesh (respecting `prefers-reduced-motion`), rotate the three feature bullets into short outcome statements with real numbers once available, and put a single institution logo slot for white-labelled deployments | ✅ mesh + drift, motion-safe · ✅ bullets replaced (they were three undeliverable claims — see A-4 in §7) · ⬜ white-label logo slot |
| **Palette** | ~~Unchanged~~ **Revised** — see the note below | ✅ repainted, auth-scoped |
| **Card** | Reduce elevation from `shadow-e2` to `e1` on mobile (cards floating on a small screen read as heavy), keep `e2` on desktop | ✅ `shadow-e1 sm:shadow-e2` |
| **Layout** | Unchanged split; add a max-width guard so the form column does not stretch past 480px on ultrawide | ✅ |
| **Motion** | 150 ms cross-fade between auth screens, 200 ms card entrance, shake-on-invalid (motion-safe only), success checkmark draw | 🟡 card entrance ✅ (320 ms, motion-safe) · cross-fade, shake and checkmark ⬜ |
| **Typography** | Existing scale; the `text-h1` 40px brand headline stays | ✅ unchanged |
| **Responsive** | 320 → 1440 verified. Below `lg`: single column, compact lockup, 48px touch targets, `inputMode="numeric"` on OTP, no fixed-position elements that fight the mobile keyboard | ✅ structurally unchanged by the repaint |
| **Accessibility** | `role="group"` + per-digit labels on OTP; `aria-live="polite"` on the resend countdown; visible focus on every control; error copy associated by `aria-describedby`; announce success states | 🟡 three hand-rolled inputs on Login / Forgot / First-login were using `border-border-strong` — the **decorative** token, which does not meet the 3:1 an interactive boundary owes (SC 1.4.11). All three now use the shared `Input`, whose `controlBase` uses `border-border-control`. The rest of the row is open |

**On the palette row, which said "unchanged".** §4.1 argued — and still argues —
that the evidence did not support "the visuals are dated", and that the real
finding was functional incompleteness. That functional work is now done (B-1
through B-5, B-7). The repaint was then asked for again, so it was built: the
flat single-hue `bg-primary-hover` fill, which is the specific thing that reads
as 2019, became a three-glow mesh in `.auth-rail`.

**What it deliberately does not touch is `--color-interactive-primary`.** That
token is bound by `tests/contrast.test.ts` and used by 44 admin screens; a
sign-in page is not a reason to move the whole product's primary. The new hues
live in `--auth-ink` / `--auth-glow-a|b|c`, scoped to two CSS classes, and every
glow sits below the base's luminance ceiling so white body copy on the rail
still clears 4.5:1. A palette change that cannot be reverted by deleting one
CSS block is not a palette change, it is a migration.

## 4.5 Complete state inventory (the deliverable the brief asks for)

Every auth screen must implement all applicable states. Current coverage in brackets.

| State | Login | OTP | Forgot | Reset | Change | First-login | MFA | Sessions |
|---|---|---|---|---|---|---|---|---|
| Idle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➕ | ➕ |
| Loading (button) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➕ | ➕ |
| Loading (page/skeleton) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ➕ | ➕ |
| Field validation (inline) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ➕ | — |
| Form error | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➕ | ➕ |
| Rate-limited (429) | ✅ | ❌ | ❌ | — | — | — | ➕ | — |
| Success | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ➕ | ➕ |
| Expired / invalid link | — | ❌ | — | ❌ | — | ❌ | — | — |
| Account locked | ❌ | ❌ | ❌ | — | — | — | — | — |
| Offline | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ➕ | ➕ |
| Empty | — | — | — | — | — | — | ➕ | ➕ |

✅ present · ❌ missing · ➕ to build · — not applicable

## 4.6 Auth work package

| # | Item | Priority | Complexity | Status |
|---|---|---|---|---|
| 1 | Feature-flag the OTP entry point | P0 | S | ✅ P3 w10 |
| 2 | TOTP MFA — enrol, challenge, recovery codes, management, admin reset | P0 | M | ✅ P3 w10 |
| 3 | Enable leaked-password protection (owner toggle) | P0 | S | 🔑 Supabase dashboard |
| 4 | My Account screen + re-point the Profile menu item | P1 | M | ✅ P3 w10 |
| 5 | Session management + security event log + idle timeout | P1 | M–L | ✅ P3 w10 |
| 6 | Inline validation across all 7 screens | P1 | M | ⬜ open |
| 7 | Missing states: success, expired link, locked, offline | P1 | M | 🟡 offline + account-locked ✅ P3 w10 · success and expired-link ⬜ |
| 8 | Password strength meter + live requirement checklist | P1 | S | ✅ P3 w10 — one rule set across Reset/Change/First-login, with a penalty for the passwords that satisfy every rule and are still trivial |
| 9 | Step-up re-auth before sensitive actions | P1 | M | 🟡 MFA unenrol requires the password; role changes and bulk destructive actions do not |
| 10 | Motion pass + mobile polish + a11y audit | P2 | M | 🟡 palette + rail + card + entrance ✅ P3 w11 · full motion pass and a11y audit ⬜ |
| 11 | SMS provider + real OTP sign-in | P1 | M | ⬜ Phase 4 w13 (blocked on a contract — risk R-1) |

---

# 5. Part C — Technology stack evaluation

## 5.1 Verdict

**The stack is correct for the stated goal and should not be replaced.** It is a well-chosen, coherent, modern set for a Bangladeshi multi-tenant SIS serving 100–500 institutions, and the team has extracted real value from it — RLS-based tenancy is the reason the AI assistant, the role model and the parent app are all cheap rather than expensive. The gaps are **additive**: things to install, not things to swap.

| Layer | Choice | Verdict | Action |
|---|---|---|---|
| Framework | Next.js 15.5.21 App Router | ✅ Correct | Keep · adopt PPR when stable |
| UI | React 19 | ✅ Correct | Keep |
| Language | TypeScript 5.7 `strict`, 0 `any` | ✅ Exemplary | Keep |
| Styling | Tailwind v4 + `@theme inline` tokens | ✅ Correct | Keep |
| Components | Bespoke `shared/ui` (24 primitives) | ⚠️ Correct but thin | **Add** a headless primitive library for the complex widgets |
| Icons | lucide-react | ✅ Correct | Keep |
| Server state | TanStack Query v5 | ✅ Correct | Keep |
| Client state | React `useState` + `useQueryState` | ✅ Correct | Keep — no global store is needed |
| Forms | **None** | ❌ **Gap** | **Add** React Hook Form + `zodResolver` |
| Validation | zod (3 of 10 modules) | ⚠️ Under-applied | Extend to all writes |
| i18n | next-intl (locale only) + inline `t(bn,en)` | ⚠️ Capped | Migrate to catalogues (A-0.8) |
| Theming | next-themes | ✅ Correct | Keep |
| Charts | Bespoke SVG (`shared/ui/Chart`) | ⚠️ Will not scale | **Add** a charting library when Reports lands |
| Database | Supabase Postgres, RLS 86/86 | ✅ Exemplary | Keep |
| Auth | Supabase Auth (GoTrue) | ✅ Correct | Enable MFA + leaked-password |
| Storage | Supabase Storage, private per-tenant bucket | ✅ Correct | Wire the upload UI |
| API | PostgREST + `SECURITY DEFINER` RPCs + a thin `/api/v1` tier | ✅ Correct | Keep; add idempotency |
| Background jobs | **None** (`pg_cron`/`pgmq`/`pg_net` available, uninstalled) | ❌ **Gap** | **Add** `pg_cron` now; `pgmq` when a provider lands |
| Testing | Vitest (121+) + pgTAP | ⚠️ Half a pyramid | **Add** Playwright + `@axe-core` |
| CI | GitHub Actions, 3 jobs | ✅ Strong | **Add** CD gating + migration deploy |
| **Hosting** | **Vercel (connected)** | ✅ Correct | **Configure** — see §5.6 |
| Monitoring | Structured logs only | ❌ **Gap** | **Add** Sentry + `@vercel/otel` + uptime |
| SMS | **None** | ❌ **Blocker** | **Add** a BD gateway |
| Payments | **None** | ❌ **Blocker** | **Add** bKash / Nagad / SSLCommerz |
| PDF/print | Browser print + `print.css` | ✅ Right first choice | Extend; add server PDF only for archival |
| Feature flags | **None** | ⚠️ Gap | **Add** (env-based is enough at this scale) |

## 5.2 Frontend — detail

**Keep.** Next.js App Router is the right choice for a role-gated, mostly-dynamic app: the middleware chokepoint, RSC prefetch+hydrate, and per-route code splitting are all being used correctly. React 19 + TS strict with zero `any` and zero `@ts-ignore` across 247 files is genuinely rare and is the reason refactors here are safe. Tailwind v4 `@theme inline` with **0 arbitrary font sizes and 0 raw hex in `features/`** means the two-theme system is structurally guaranteed rather than maintained by discipline.

**Add — React Hook Form + `@hookform/resolvers/zod`.** This is the single highest-value dependency addition in the report. The product has 197 `<Field>` call sites, no form library, no inline errors, and manual `useState` field-by-field wiring in every form (`RegistrationScreen` carries a 31-key `EMPTY` object and a hand-rolled `up()` setter). RHF gives uncontrolled inputs (fewer re-renders on a 60-row marks grid), a dirty-state signal that makes the unsaved-changes guard (A-0.6) trivial, field-level error objects that map straight onto the `Field error` prop that already exists, and `zodResolver` so the three existing schemas become form schemas with no rewrite. Roughly 12 kB gzipped against a measurable reduction in form code.

**Add — a headless primitive library (Radix UI or React Aria) for complex widgets only.** The bespoke `shared/ui` is correct for Button, Badge, Field, Table, Card — simple, tokenised, no dependency. It is *not* correct for combobox, date range picker, dropdown menu, tooltip and popover, which are where hand-rolled components accumulate accessibility bugs. The evidence is already in the tree: `<button>` nested inside `<label>` for toggles, a `role="menu"` container with hand-rolled focus trapping, and a profile menu whose overlay is a `<button aria-hidden tabIndex={-1}>`. Adopt Radix for those five widget classes, style them with the existing tokens, and leave the rest alone. This is not a design-system replacement.

**Add — a charting library, when Reports lands.** `shared/ui/Chart` (BarChart, Donut) is a good bespoke choice for two fixed dashboard visuals. It will not survive a report builder that needs stacked bars, line series, tooltips, legends, responsive containers and export. Recommend **Recharts** (React-native API, tree-shakeable) over a D3-direct build.

**Do not add.** No Redux/Zustand/Jotai — server state is TanStack's and URL state is `useQueryState`'s, which is the correct division and is working. No component-library replacement (MUI/AntD/shadcn) — it would discard a working token system for a heavier one. No CSS-in-JS.

## 5.3 Backend / API — detail

**Keep the architecture.** Writes go through `SECURITY DEFINER` RPCs with `SET search_path TO ''` and an internal `private.current_institution_id()` tenant guard; reads go through `security_invoker` views and PostgREST under RLS. This is a genuinely good pattern for this problem: writes are transactional and tenant-safe by construction, and there is no application server to scale or secure. The thin `src/server/` tier for the cases that need validate → limit → authorise → audit before an external call (SMS) is the right escape hatch, and the layering is enforced by `eslint-plugin-boundaries` with `default: disallow`.

**Add.**
- **Idempotency keys** on money-moving and bulk RPCs (`fn_collect_fee`, `fn_run_migration`, `fn_send_sms_campaign`, `fn_delete_fee_invoice`). A client-generated UUID stored with a unique constraint turns a retry into a no-op. Today a double-click at a cash counter can double-post.
- **zod at every write boundary**, not three. Every RPC takes one `jsonb` payload and casts in SQL, so a renamed key is silently dropped — which is exactly the class of bug `collectPayloadSchema.strict()` was written to catch. Ten modules, three covered.
- **A documented API surface.** Generate an OpenAPI description for `/api/v1` and publish the RPC contracts. Currently the contract lives in TypeScript types and SQL, which is fine for one team and not fine for a mobile client or an integration partner.
- **Optimistic concurrency** (`updated_at` precondition) on settings, marks and grading RPCs.

**Do not add.** No separate Node/Nest/Go API service. It would duplicate the authorisation model that RLS already enforces, and every duplicated authorisation model eventually diverges.

## 5.4 Database — detail

**Keep, and treat as the project's strongest asset.** RLS on 86/86 tables with 110+ policies, policies wrapping tenant helpers in `(SELECT …)` for plan caching, zero unindexed foreign keys, 49 migrations in version control each md5-verified against the remote history, a pgTAP job that replays every migration from empty on each CI run, `attendance` and `mark` partitioned by academic year with the partition key set at the write path, hot-path indexes, append-only audit logging with trigger coverage, and role-based policies plus RPC permission guards. Advisors are clean apart from `unused_index` INFO notices, which ADR-0002 correctly refuses to prune blind.

**Add.**
- **`pg_cron`** — available and uninstalled. Needed for monthly invoice generation (the migration exists with no schedule), fee reminders, digest reports and retention jobs. One `create extension`.
- **`pgmq`** — when the SMS provider lands, for delivery batching and retry (ADR-0001's trigger).
- **A read replica** at the 100k tier (ADR-0002's territory).
- **Restore rehearsal** — still never performed. A backup that has never been restored is a hypothesis, not a control.

**Watch.** The single-project multi-tenant model is correct to ~500 institutions. Past that, evaluate database-per-region or schema-per-large-tenant. Do not pre-build it.

## 5.5 Authentication — detail

Supabase Auth (GoTrue) is correct: it is the reason the JWT `app_metadata` role gate is trustworthy (service-role-writable only), and it is what makes RLS's `auth.uid()` work. **Enable MFA and leaked-password protection** (both are configuration). **Review the rate limits for a school access pattern** — an entire staff room shares one NAT'd IP and can exhaust a per-IP token bucket at the start of a shift; the runbook already carries the `PATCH .../config/auth` call.

**Do not** move to Auth0/Clerk/NextAuth. Any of them severs `auth.uid()` from RLS and would require rebuilding the tenancy model in application code.

## 5.6 Cloud infrastructure & deployment — **Vercel**

Vercel is connected, and it is the right host: Next.js first-party support, edge middleware, atomic deploys, instant rollback, preview environments per PR. What follows is what to **configure**, because the defaults are wrong for this application in one important way.

### 5.6.1 🔴 The region defect — configure this first

**Problem.** Supabase runs in **`ap-south-1` (Mumbai)** (per the runbook). Vercel's default serverless function region is **`iad1` (Washington, D.C.)**. Every server-side Supabase call from an RSC page, a route handler or a server action therefore crosses the Atlantic and the Indian Ocean — roughly **200–250 ms round trip, per query**.

**Why it matters here specifically.** The dashboard's `fetchDashboard` issues **six queries in a `Promise.all`** during a server prefetch. Even fully parallelised, that is one ~220 ms cross-region penalty on the app's most-visited screen, on top of render time — and it lands on first paint, where it is most visible. The teacher-list prefetch pays it too. The prior audit measured 150–370 ms per warm navigation *without* this factor, because it was measured locally.

**Fix.** Create `vercel.json`:

```json
{
  "regions": ["bom1"],
  "framework": "nextjs"
}
```

`bom1` is Mumbai — same metro as `ap-south-1`, reducing that hop to single-digit milliseconds. Middleware continues to run on the global edge network (it does a local ES256 JWT verify via `getClaims()`, not a network call, so edge placement is correct for it). Users are in Bangladesh; Mumbai is also the closest Vercel region to them, so this is the right choice for both DB proximity and user proximity.

> **Priority P0 · Complexity S (one file) · Expected impact: ~200 ms off every server-rendered page load. The highest performance-per-effort item in the entire report.**

### 5.6.2 Environments and the preview-data hazard

**Problem.** Preview deployments are built from PR branches. Unless configured otherwise, they inherit production environment variables — meaning **every PR preview URL is a live application pointed at real students' data**, reachable by anyone with the link.

**Fix.**
1. **Enable Vercel Deployment Protection** (Standard Protection / Vercel Authentication) on Preview and Development so only team members can open a preview URL. This is a checkbox and it is the most important non-code security action available today.
2. **Give previews their own database.** Supabase branching creates an ephemeral branch DB per PR with the migrations applied; point Preview `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` at it. Previews then exercise real migrations against synthetic data.
3. **Scope environment variables per environment** in Vercel (Production / Preview / Development). Note that `NEXT_PUBLIC_*` values are **baked at build time**, so each environment needs its own build — which Vercel does by default, but it means a value changed in the dashboard requires a redeploy to take effect. Document that in the runbook.
4. **`SUPABASE_SERVICE_ROLE_KEY` must exist in Production only**, and never as a `NEXT_PUBLIC_` variable. Current source has **0 `service_role` references in client code** — keep it that way and add a CI grep to enforce it.

| Environment | Branch | Database | Protection | Purpose |
|---|---|---|---|---|
| Production | `main` | Supabase prod (`ap-south-1`) | Public | Live |
| Preview | any PR | Supabase branch DB per PR | Vercel Auth | Review + migration replay |
| Development | local | local `supabase start` | n/a | Dev |

### 5.6.3 The CD gap — CI and Vercel do not talk to each other

**Problem.** GitHub Actions runs a real gate (`typecheck → lint --max-warnings 0 → test → build`, plus pgTAP and a blocking production dependency audit). **Vercel builds independently and deploys regardless of whether that gate passed.** So a commit that fails lint, fails tests, or fails the RLS policy suite can still reach production — the gate is advisory in practice. The two systems also duplicate the `next build`, doubling build minutes.

**Fix — the "build once, gate, then deploy" pipeline:**

```yaml
# .github/workflows/deploy.yml (new — runs after verify/rls/audit succeed)
deploy:
  needs: [verify, rls, audit]          # the existing gate becomes blocking
  if: github.ref == 'refs/heads/main'
  steps:
    - run: npx vercel pull  --yes --environment=production --token=$VERCEL_TOKEN
    - run: npx vercel build --prod --token=$VERCEL_TOKEN
    - run: npx vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
```

and in the Vercel project, set **Ignored Build Step** to `exit 0` (skip) for pushes so Vercel does not build in parallel. Net effect: one build, gated, atomic, with Vercel still owning hosting, CDN, rollback and preview URLs.

### 5.6.4 Database migrations in the deploy pipeline

**Problem.** Migrations are applied manually. There are 49 of them and no automated path from `supabase/migrations/*` to the production database, so schema and code can deploy out of order — the classic cause of a broken production release.

**Fix.** Add a migration job that runs **before** the app deploy on `main`:

```yaml
migrate:
  needs: [verify, rls]
  steps:
    - uses: supabase/setup-cli@v1
    - run: supabase link --project-ref $SUPABASE_PROJECT_ID
    - run: supabase db push          # applies only unapplied migrations
```

Enforce the expand-then-contract discipline (add nullable column → deploy code → backfill → make non-null → remove old code) so a rollback of the app never requires a rollback of the schema. Record it as an ADR.

### 5.6.5 Observability on Vercel — closes the largest operational gap for near-zero effort

The audit scored Monitoring 45 and Observability 60, capped because "an APM vendor is a purchase". On Vercel, three of the four gaps close cheaply:

| Gap | Fix | Cost |
|---|---|---|
| No traces | `@vercel/otel` + `next.config` instrumentation → OTLP endpoint | Free package |
| No error alerting | **Sentry** (`@sentry/nextjs`) — wire into the existing `instrumentation.ts#onRequestError` funnel rather than replacing it | Free tier covers this scale |
| No RUM / Web Vitals | Vercel Speed Insights + Analytics | Included on Pro |
| Nothing polls `/api/health` | Better Stack / UptimeRobot → `/api/health`, alert to the on-call channel | Free tier |
| Logs are ephemeral | Vercel **Log Drain** → Better Stack / Axiom. The structured PII-scrubbing JSON logger already emits exactly the right shape | ~free at this volume |

Also: add `VERCEL_GIT_COMMIT_SHA` to the `/api/health` payload (the runbook already expects a `commit` field for post-rollback verification), and enable **Skew Protection** — this app is used by staff who leave a tab open all day, and without it a deploy mid-session serves a client bundle whose RSC payloads no longer exist.

### 5.6.6 Scheduled work

Two schedulers, used for different things — do not mix them:
- **`pg_cron` in Supabase** for anything that is pure SQL: monthly invoice generation, retention/archival, materialised refreshes. It runs next to the data with no network hop and no cold start.
- **Vercel Cron** for anything needing application code: the weekly head-teacher digest, gateway reconciliation polling, SMS retry sweeps. Note the Hobby-plan limit (daily granularity) — Pro is required for finer schedules.

### 5.6.7 Deployment checklist (to be added to the runbook)

**One-time**
- [ ] `vercel.json` with `"regions": ["bom1"]` — **P0**
- [ ] Deployment Protection ON for Preview + Development — **P0**
- [ ] Environment variables scoped per environment; service-role key Production-only
- [ ] Ignored Build Step set; GitHub Actions owns build + deploy
- [ ] `supabase db push` migration job on `main`
- [ ] Sentry + log drain + uptime monitor + Speed Insights
- [ ] Skew Protection ON; `commit` in `/api/health`
- [ ] Custom domain + HSTS preload submission (the header is already correct)
- [ ] Supabase branching for preview environments

**Per release**
- [ ] CI green (typecheck · lint · unit · pgTAP · prod audit)
- [ ] Migrations applied and replayable from empty
- [ ] `/api/health` returns 200 with the expected `commit`
- [ ] Smoke: sign in → dashboard renders live data → one write succeeds
- [ ] Rollback path confirmed (previous deployment still promotable)

## 5.7 DevOps / CI-CD — summary

**Strong today:** 3-job pipeline with the cheapest gate first; `--max-warnings 0`; an executable architecture test; a pgTAP job that doubles as a migration-replay check; a blocking production dependency audit with a documented, tested trap (`brace-expansion` v5 silently disarms ESLint's globbing — pinned by a test).

**Add:** the CD gating and migration jobs above; Playwright E2E in the pipeline (login, admission, collect fee, mark attendance, enter marks — five journeys); `@axe-core/playwright` gating on zero serious/critical; a bundle-size budget check; and Dependabot/Renovate on a weekly cadence.

## 5.8 What to remove

Very little, which is a good sign.

| Item | Why | Action |
|---|---|---|
| `/admin/styleguide` (255 lines) | An internal design-system page shipped inside the authenticated admin app and reachable by any admin user. It is developer documentation, not a product screen | Move behind `NODE_ENV !== "production"` or to a docs site |
| `scripts/scaffold-admin-screens.ps1`, `collect-admin-screens.workflow.js`, `admin-screens.manifest.json` | One-time scaffolding artefacts; already ESLint-ignored | Delete or move to `tools/` |
| The `remember` checkbox on Login | Currently decorative (documented in-source) | Make it functional or remove it |
| The 5 disabled buttons + 2 "(soon)" buttons | A-0.3 | Delete |
| `next-intl` — **do not remove** | It is under-used, not wrong. The fix is to use its catalogue system (A-0.8) | Keep and adopt properly |

## 5.9 Cost model at 100 institutions (~50k students)

| Item | Tier | Monthly (USD) |
|---|---|---|
| Vercel | Pro (team, protection, cron, skew protection) | ~20/seat |
| Supabase | Pro → Team as storage/compute grows | 25 → 599 |
| Sentry | Team | 0 → 26 |
| Log drain (Axiom/Better Stack) | Free → paid | 0 → 25 |
| Uptime monitor | Free | 0 |
| SMS gateway | Per message, BDT | volume-driven — **the dominant variable cost** |
| Payment gateway | ~1.5–2.5% per transaction | volume-driven |

The controllable insight: **SMS is the largest recurring cost and it is currently billed against a hand-typed number (F-2).** Fixing recipient resolution and segment counting is a cost-control measure as much as a correctness fix.

---

# 6. Part C-2 — Screen portfolio: what to add, merge, and remove

The brief invites recommendations on the screen inventory itself. The current admin app has **56 routes served by 44 implementations** — a 1.27:1 ratio that reveals real duplication, alongside genuine gaps where the product has no screen at all for something an SIS must do.

## 6.1 Screens to MERGE — 56 routes → 44

Each of these pairs is **already the same React component distinguished only by a prop that changes a heading**. Merging them removes navigation choices that carry no information.

| Merge | Into | Evidence | Saving |
|---|---|---|---|
| `attendance/section` + `attendance/update-section` | **Attendance › Take (Section)** | Both render `<AttendanceMarker context="daily" />`; the marker already hydrates existing marks, so "update" is what it does anyway | −1 |
| `attendance/exam` + `attendance/update-exam` | **Attendance › Take (Exam)** | Both render `<AttendanceMarker context="exam" />` | −1 |
| `exam/mark-input` + `exam/mark-update` | **Exam › Marks Entry** | Both render `<MarksEntry mode>`; `mode` changes only the `<h1>` | −1 |
| `student/migration-merit` + `student/migration-nomerit` | **Students › Promotion** with a "Rank by" toggle | Both render `<MigrationRunner type>` | −1 |
| `fee/quick-collection-list` + `fee/quick-collection-form` | **Fees › Collection** (list with a collect drawer) | The list is the entry point to the form; splitting them costs a navigation per payment | −1 |
| `fee/unpaid-section` + `fee/unpaid-institute` | **Fees › Outstanding** with a scope filter | Same report at two scopes | −1 |
| `certificate/admit-instruction` + `certificate/exam-essentials` | **Documents › Exam Document Settings** | Both render `<SettingConfig>` | −1 |
| `exam/result-process` + `exam/result-sheet-download` | **Exam › Results** (process + view as tabs) | Both render `<ResultProcessor mode>` | −1 |
| `exam/mark-process` | Fold into **Exam › Results** | Overlaps result processing; its distinct purpose is not expressed in the IA | −1 |
| `student/reports-summary` ↔ Insights › Reports | Keep one canonical home | Currently one route reached from two rail positions | −1 (IA only) |

**Result: 56 → 46 routes, with zero capability lost and ten fewer decisions per operator.** Preserve every old URL with a redirect — the codebase's own IA rebuild took that discipline and it should hold.

## 6.2 Screens to REMOVE

| Screen | Reason |
|---|---|
| `/admin/styleguide` | Internal developer documentation inside the authenticated product (§5.8) |

That is the only outright removal. Everything else earns its place once completed.

## 6.3 Screens to ADD

Ordered by priority. **P0 items are things a school management system is expected to have and this one does not.**

| # | New screen | Module | Why it must exist | Priority |
|---|---|---|---|---|
| 1 | **Student Profile** `/admin/student/[id]` | Students | **There is no single-student view anywhere in the product** — and no dynamic routes at all in `/admin`. A registrar cannot open "this student" and see enrolment, attendance, marks, fees, documents, guardians and history in one place. This is the most-wanted screen in any SIS | **P0** |
| 2 | **Fee Receipt / Print** | Fees | A collection screen with no receipt forces a parallel paper ledger (A-6.1) | **P0** |
| 3 | **Document Preview & Print** | Documents | Seven configuration screens currently produce no artefact (A-7) | **P0** |
| 4 | **User & Role Management v2** | Settings | RBAC exists in the DB and is unreachable (A-0.4) | **P0** |
| 5 | **Permission Matrix** | Settings | Makes `role_permission` visible and editable | **P0** |
| 6 | **Import Wizard** (shared, surfaced per module) | Cross-cutting | Onboarding 800 students by hand is the adoption blocker (A-0.5) | **P0** |
| 7 | **Academic Calendar** | Settings | Holidays/terms/non-teaching days — absent, and it corrupts every attendance statistic (A-4) | **P0** |
| 8 | **My Account** (profile · security · preferences) | Auth/Settings | The Profile menu currently links to the all-users list (B-4) | **P0** |
| 9 | **MFA enrolment & Session management** | Auth | B-2, B-3 | **P0** |
| 10 | **Result Publication & Tabulation Sheet** | Exam | Publication has no gate; the tabulation sheet is the artefact schools actually produce (A-5.2) | **P0** |
| 11 | **Teacher Profile** `/admin/teacher/[id]` | Teachers | Same argument as (1); also fixes the row action that opens a generic screen | P1 |
| 12 | **Expense / Voucher Entry** | Fees | The Income Statement has an Expenditure ledger with no way to populate it (A-6.2) | P1 |
| 13 | **Fee Structure & Heads** | Fees/Settings | Fee mapping exists; head definition does not surface | P1 |
| 14 | **Day Book / Cash Close** | Fees | Per-collector daily reconciliation — the control that makes cash auditable | P1 |
| 15 | **Marks Entry Progress board** (subject × section) | Exam | What an exam controller needs during the entry window (A-5.1) | P1 |
| 16 | **Class Routine / Timetable** | Academics | A standard SIS module that is entirely absent; also the prerequisite for period-wise attendance | P1 |
| 17 | **Report Builder** | Insights | "Insights" is a top-level zone containing one fixed summary (A-2.2) | P1 |
| 18 | **Global Search results** | Cross-cutting | `⌘K` finds screens, not students. "Find student 2026-0417" is the registrar's most frequent intent | P1 |
| 19 | **Notification Preferences** | Settings | Which events trigger SMS, per role — currently hardcoded | P1 |
| 20 | **Backup & Data Export** | Settings | Data portability; increasingly a contractual expectation | P1 |
| 21 | **Invoice Generation Review** | Fees | Preview/approve the monthly run before it creates thousands of invoices | P1 |
| 22 | **EduSathi AI (real)** | Overview | The differentiator is an empty state (A-10) | **P0 for positioning** |
| 23 | **Attendance Register (printable monthly)** | Attendance | Schools are required to keep it | P2 |
| 24 | **Library · Transport · Hostel · Payroll** | New modules | Market-standard for the segment; scope after the core is complete | P2 |
| 25 | **Institution Branding** | Settings | Logo, letterhead, colours — needed by document rendering and by white-label deployments | P2 |

**Net portfolio change:** 56 routes → **46 (after merges) + 22 new = ~68 routes**, but with a materially simpler mental model: fewer near-duplicate destinations, and a detail page for every entity the system stores.

## 6.4 The structural insight behind this list

Ten of the twenty-five additions are **entity detail pages or artefacts** — a student, a teacher, a receipt, a certificate, a register, a tabulation sheet. The current admin app is built almost entirely from *operations* (do a thing to a set of rows) and almost not at all from *records* (look at one thing). That is why there are no dynamic routes in `/admin`. A school administrator's work alternates constantly between the two, and the missing half is why several screens feel like dead ends — the Teacher Directory's "Edit profile" action, the Dashboard's non-clickable KPIs, the Registration screen's reset-to-empty on success are all the same absence showing up three times.

**Adding entity detail pages is therefore not 10 features. It is one architectural correction that resolves a recurring class of UX defect.**

---

# 7. Part D — Consolidated findings register

Priority: **P0** blocks paid institutional operation · **P1** visible quality/completeness gap · **P2** polish.
Complexity: **S** ≤ 1 day · **M** 1–3 days · **L** 1–2 weeks · **XL** > 2 weeks.

**Status** (added 2026-08-01, end of Phase 3). ✅ **Done** · 🟡 **Partial** — what
remains is stated · ⬜ **Open** — not started, with the phase that owns it ·
🔑 **Owner** — an account, a dashboard toggle or a contract, not an engineering
task. Verified against `docs/SRA_IMPLEMENTATION.md` and the repository at the
Phase 3 exit commit; where the log and the code disagreed, the code won.

| ID | Finding | Area | Business impact | Pri | Cx | Status |
|---|---|---|---|---|---|---|
| A-0.2 | Validation invisible — 0/197 `Field` call sites use `error` | Cross | Data-entry errors, support load, WCAG 3.3.1/3.3.3 fail | P0 | L | 🟡 the 5 highest-traffic forms only; the other ~39 screens still have none |
| A-8.1 | SMS recipient count hand-typed; segments counted as GSM-7 for Bangla | Comms | **Direct billing error, both directions** | P0 | M | ✅ P1 w2 |
| A-0.3 | 5 permanently disabled controls + 2 "(soon)" buttons | Cross | "Product is broken" on first use | P0 | S | ✅ P1 w1 (+2 more found in P2 w4/w5) |
| A-0.4 | RBAC in DB, absent from UI; User Management read-only | Settings | No delegation; audit log meaningless; procurement blocker | P0 | L | 🟡 assign/suspend/matrix/rail done; **invite still not built** (needs a service-role server route) |
| A-2.2 | Migration merit rank = list index; `result` hardcoded `"pass"` | Students | Academically invalid permanent records | P0 | M | ✅ P1 w2 |
| 5.6.1 | Vercel functions in `iad1`, Supabase in Mumbai | Infra | ~200 ms on every server render | P0 | S | ✅ P1 w1 (`bom1`; latency unmeasured) |
| 5.6.2 | Preview deploys unprotected against production data | Infra | Real student data on public preview URLs | P0 | S | 🔑 Vercel dashboard — **live risk R-8 until set** |
| 5.6.3 | CI gate is advisory — Vercel deploys regardless | Infra | Failing code can reach production | P0 | M | ✅ P1 w1 · 🔑 needs the Ignored Build Step set |
| A-6.1 | No receipt on fee collection | Fees | Forces a parallel paper ledger; ledgers diverge | P0 | M | ✅ P3 w9 (A5 + 80mm thermal, reprintable) |
| A-6.1 | No idempotency / no void on payments | Fees | Double-posting; unrecoverable mistakes | P0 | M | ✅ idempotency P1 w2 · void-as-reversal P3 w9 |
| A-7 | Documents module produces no documents | Docs | Likely pilot-to-purchase blocker | P0 | XL | ✅ P3 w8–w9 (ID/admit/testimonial/transfer/marksheet/tabulation, QR-verified) |
| A-0.5 | No data import anywhere | Cross | 40–80 h onboarding cost per institution | P0 | XL | ✅ P3 w11 — one wizard, Students + Teachers + Marks |
| A-5.1 | Full marks free-text, ignores `mark_config` | Exam | Silently wrong GPA for a whole section | P0 | M | ✅ P1 w2 |
| A-5.1 | No component marks (written/MCQ/practical/CA) | Exam | Cannot represent the national assessment model | P0 | XL | ⬜ deferred to Phase 5 (schema change on partitioned tables — risk R-2) |
| A-5.1 | Marks: no autosave, no concurrency control, no lock workflow | Exam | Lost and silently overwritten marks | P0 | L | 🟡 autosave P1 w3 · publication gate P3 w9 · **no optimistic concurrency** — two teachers on one section still last-write-wins |
| A-5.2 | No result publication gate; unguarded re-processing | Exam | Uncontrolled release; integrity hazard | P0 | L | ✅ P3 w9 — gate is RLS, not UI; re-processing a published exam refused in the RPC |
| A-9.1 | Grading scheme accepts overlapping/gapped ranges | Settings | Silently wrong grades cohort-wide | P0 | S | ✅ P1 w2 |
| A-4 | No "already taken" indicator on attendance (with SMS side effect) | Attend | Ambiguous destructive action that spends money | P0 | M | ✅ P1 w3 (names who took it and when) |
| A-4 | Offline attendance advertised on the auth screen, not built | Attend | Claim the product cannot demonstrate | P0 | S/XL | ✅ claim removed P3 w11 — **and so were the other two**, see the note below. Offline capture itself remains ⬜ |
| A-4 | Weekends and holidays not modelled; attendance can be taken on Eid | Attend | Corrupts every attendance statistic reported | P1 | M | ✅ P3 w11 — Academic Calendar + terms; `fn_attendance_summary` excludes non-working days |
| A-2.1 | Photo/document upload UI inert; blocks ID cards | Students | Downstream module blocked | P0 | M | ✅ P3 w8 (EXIF stripped client-side) |
| A-2.1 | No duplicate-student detection | Students | Classic SIS data-quality failure | P0 | M | ⬜ open — and now higher-stakes, since the importer can admit 500 at once |
| A-0.6 | No unsaved-changes guard; no autosave | Cross | Routine data loss on flaky networks | P0 | M | 🟡 `beforeunload` + autosave done; **in-app `<Link>` navigation is not covered** (App Router exposes no cancellable route-change event) |
| B-1 | OTP entry point advertised, non-functional | Auth | Broken first impression | P0 | S | ✅ P3 w10 — behind `NEXT_PUBLIC_OTP_ENABLED`, default off |
| B-2 | No MFA | Auth | Security-questionnaire blocker; minors' data | P0 | M | ✅ P3 w10 — TOTP, 10 hashed recovery codes, super-admin reset, audited |
| B-5 | Leaked-password protection off (owner toggle) | Auth | Only standing security advisory | P0 | S | 🔑 Supabase dashboard · client-side policy + meter ✅ P3 w10 |
| B-4 | "Profile" menu links to the all-users list | Auth | Mislabelled navigation | P0 | M | ✅ P3 w10 — `/admin/account`, menu re-pointed |
| A-10 | EduSathi AI is an empty state | Product | The differentiator is undelivered | P0 | XL | ⬜ Phase 4 w15 |
| A-0.1 | Data-interaction contract on 1/44 screens | Cross | Core administrative work is slow and unshareable | P0 | L | ✅ P2 w4–w5 — 14/14 list screens (a hook + `DataToolbar`, not a 40-prop table) |
| — | No entity detail pages anywhere in `/admin` | IA | Recurring dead-end UX (§6.4) | P0 | L | ✅ P2 w7 — Student + Teacher profiles, each linking to its own audit trail |
| 5.2 | No form library | FE | Root cause of A-0.2's cost | P0 | S | ✅ met differently — `useZodForm` (~90 ln, no dependency). RHF deliberately not added; see the implementation log |
| 5.4 | `pg_cron` uninstalled; invoice migration unscheduled | DB | Automation blocked | P1 | S | ⬜ Phase 4 w12 |
| 5.6.4 | No automated migration deploy | Infra | Schema/code deploy ordering risk | P1 | M | ✅ P1 w1 (`supabase db push` gates the app deploy) |
| 5.6.5 | No alerting, no traces, nothing polls `/api/health` | Ops | Users find incidents first | P1 | M | ✅ code P1 w1 · 🔑 needs `OBSERVABILITY_ALERT_URL` + an uptime vendor |
| A-0.7 | No grid keyboard navigation on marks/attendance | A11y | 60 Tab presses per section | P1 | M | ✅ P2 w5 (`useGridNavigation`; `1..4` picks a status) |
| A-0.7 | 9 screens use `<div>` tables | A11y | Screen readers announce undifferentiated text | P1 | M | ✅ P2 w5 — 10 tables across 8 screens |
| A-0.7 | No a11y audit or conformance statement | A11y | Procurement risk | P1 | M | ⬜ Phase 4 w14 (`@axe-core` gate + WCAG statement) |
| A-0.8 | i18n inline at ~4,000 sites; no catalogues, no ICU | i18n | Third language impossible; plural bugs | P1 | L | ⬜ deferred to Phase 5 (codemod, not hand-editing — risk R-6) |
| A-0.8 | UTC dates shown to a UTC+6 audience | Cross | Off-by-one dates after 18:00 local | P1 | S | ✅ P1 w1 — `shared/lib/format.ts`, institution time |
| A-6.2 | No expense entry — Income Statement half-built | Fees | Accounting module incomplete | P1 | M | ⬜ open |
| A-6.2 | No ageing buckets on outstanding fees | Fees | No basis for a collection strategy | P1 | M | ⬜ open |
| A-6.2 | Income Statement: hardcoded bilingual headers; loss shown as credit | Fees | i18n leak + misread financials | P1 | S | ⬜ open (the ledgers moved onto `shared/ui/Table` in P2 w5; the copy and the sign did not change) |
| A-3.1 | Teacher row action "Edit profile" carries no id | Teachers | Action does not do what it says | P0 | S | ✅ P1 w1 — `?id=` is URL-backed, so an open profile is linkable |
| A-3.2 | No HR/employment data model | Teachers | Purchase objection above ~30 staff | P1 | L | ⬜ deferred to Phase 5 |
| A-1 | Dashboard: no period control, no KPI drill-down, `hasSubjects` hardcoded | Dash | Status board, not an instrument | P1 | M | ✅ period control + drill-down P2 w7 · `hasSubjects` P1 w1 · period-over-period deltas and role-aware sections P3 w11. Residue in §3.1: customisation (item 4), configurable thresholds (6), EduSathi bar (9) |
| A-9.2 | Audit log: no date/actor filter, no export, raw JSON diff | Settings | Not usable as a compliance artefact | P1 | M | 🟡 filter/sort/export came with the A-0.1 contract in P2 w5; **the before/after is still `JSON.stringify`**, not a field-level diff |
| A-0.9 | Eight unexploited automation opportunities | Cross | System of record, not of action | P1 | L | ⬜ Phase 4 w12 |
| 5.7 | No E2E tests, no a11y gate | Test | Regressions reach production | P1 | L | ⬜ Phase 4 w14 — 361 unit tests today, zero E2E |
| — | Restore never rehearsed | DR | Backups are a hypothesis | P1 | S | ⬜ Phase 4 w14 |
| B-3 | No session management | Auth | Shared-computer exposure | P1 | M | ✅ P3 w10 — device/IP/last-active, per-session + all-others revoke, security event log, 25/30-min idle timeout |
| 5.2 | Hand-rolled complex widgets (menu, toggle, popover) | FE | Accumulating a11y defects | P2 | M | ⬜ open |
| §6.1 | 10 near-duplicate routes | IA | Ten meaningless decisions per operator | P2 | M | ⬜ open (the P2 w1 nav rebuild regrouped the rail; the routes themselves still exist) |
| 5.8 | `/admin/styleguide` ships to production | Ops | Internal docs inside the product | P2 | S | ⬜ open — still in the production route table |

**Tally at Phase 3 exit: 30 done · 6 partial · 4 owner-blocked · 15 open.** Of the
29 P0 rows, 21 are closed; the P0s still open are component marks, duplicate
detection and EduSathi (all XL, all scheduled), plus preview Deployment
Protection, which is a checkbox and the one live risk in the register.

**The auth-screen claims (A-4).** The register carried one row for this —
offline attendance. Checked while redesigning the screen, **all three** feature
bullets on the sign-in rail were undeliverable: the SMS gateway and the payment
gateway are Phase 4 week 13 and EduSathi is week 15. The first screen every
evaluator sees made three promises the product could not demonstrate, which is
finding A-0.3's principle applied to marketing copy instead of buttons. All
three are now statements of shipped capability.

---

# 8. Part E — Implementation roadmap

Assumes **2 engineers + 0.5 designer**. Each phase ends with a demonstrable, shippable increment.

## Phase 1 — Integrity & honesty (3 weeks) → score 73 → 80

*Principle: stop the product from being wrong or from claiming things it cannot do. Cheapest work, highest trust return.*

| Week | Work |
|---|---|
| 1 | `vercel.json` region `bom1` · Deployment Protection on previews · CI gates deploy · `supabase db push` job · Sentry + log drain + uptime monitor · Skew Protection · `commit` in `/api/health` · enable leaked-password protection · **delete the 7 dead controls** · fix Teacher row-action id · fix `hasSubjects` · centralise timezone formatting |
| 2 | **F-2:** SMS recipient resolver + encoding-aware segment/cost preview · **F-5:** migration merit rank from `exam_result` + dry-run preview · grading-scheme range validation · marks full-marks derived from `mark_config` · fee-collection idempotency key + over-payment guard |
| 3 | Add React Hook Form + `zodResolver` · **inline validation on the 5 highest-traffic forms** (Admission, Teacher Onboarding, Fee Collection, Marks Entry, Basic Config) · unsaved-changes guard · localStorage autosave on Marks Entry and Attendance · attendance "already taken" banner + SMS preview |

**Exit criteria:** zero dead controls · zero screens that bill against operator-typed numbers · inline validation on the 5 forms · CI gates production · alerting live · sub-100 ms server-to-DB latency.

## Phase 2 — The operating surface (4 weeks) → 80 → 86

| Week | Work |
|---|---|
| 4 | Extract `useDataScreen` from the Teacher Directory · migrate 4 list screens |
| 5 | Migrate the remaining 10 list screens · `useGridNavigation` for Marks Entry + Attendance · migrate 9 `<div>` tables to `shared/ui/Table` |
| 6 | **User & Role Management v2** + Permission Matrix + populate `AdminModule.roles` |
| 7 | **Student Profile** and **Teacher Profile** detail pages · global entity search in `⌘K` · dashboard KPI drill-down + period selector |

**Exit criteria:** 14 list screens with the full contract · RBAC usable end to end · every stored entity has a detail page.

## Phase 3 — Artefacts, auth & completeness (4 weeks) → 86 → 91 · **COMPLETE**

| Week | Work | Status |
|---|---|---|
| 8 | Document rendering layer (print-CSS) + ID card and admit card templates · wire student photo upload | ✅ `e6c37e3` |
| 9 | Fee receipt + day book · testimonial/transfer/marksheet templates · tabulation sheet · result publication gate | ✅ `e04b272` |
| 10 | MFA · session management · My Account · missing auth states · password strength + requirements | ✅ `070e48a` |
| 11 | Import Wizard + Students/Teachers/Marks importers · Academic Calendar | ✅ |

**Exit criteria:** every document the system configures, it can print ✅ · MFA enforced for admin roles ✅ · a school can onboard by import ✅.

Week 11 also carried the dashboard and auth-screen work requested alongside it:
the A-1 residue that A-0.4 had been blocking (role-aware sections,
period-over-period deltas) and the auth palette redesign (§4.4, revised — see
the note there on why the repaint is scoped to `.auth-rail` rather than to
`--color-interactive-primary`).

## Phase 4 — Automation, scale & assurance (4 weeks) → 91 → 95

| Week | Work |
|---|---|
| 12 | `pg_cron` + invoice generation schedule + review screen · fee reminder rules · weekly digest |
| 13 | SMS gateway integration + `pgmq` queue + delivery receipts · payment gateway + reconciliation |
| 14 | Playwright E2E (5 journeys) + `@axe-core` gate · restore rehearsal · WCAG conformance statement |
| 15 | **EduSathi AI v1** — grounded Q&A under RLS, dashboard prompt bar, audit + quota |
| — | *Deferred to Phase 5:* i18n catalogue migration (L) · component marks (XL) · HR module · Timetable · Report Builder |

**Exit criteria:** the recurring clerical loop runs itself · both gateways live · a green E2E + a11y gate · the differentiator demonstrable.

---

# 9. Part F — Risk register, acceptance criteria & KPIs

## 9.1 Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | SMS/payment gateway contracts slip, blocking Phase 4 | High | High | Start commercial negotiation in Phase 1; build against an adapter interface with a mock provider so integration is a swap |
| R-2 | Component marks (A-5.1) proves to be a schema migration on partitioned tables | Medium | High | Spike in Phase 2; expand-then-contract; the partitioning is by academic year, so backfill is bounded per partition |
| R-3 | Document rendering fights browser print inconsistency (card sizing, page breaks) | Medium | Medium | Result Sheet already proves the approach; prototype the CR80 ID card first (the hardest case); keep a server-PDF fallback scoped but unbuilt |
| R-4 | The A-0.1 migration regresses screens that currently work | Medium | Medium | Migrate behind the existing test discipline; E2E on the 5 journeys before the migration begins, not after |
| R-5 | RBAC rollout locks an operator out of a screen they need | Medium | Medium | Ship roles permissive-then-tighten, with a super-admin override and audit visibility from day one |
| R-6 | i18n catalogue migration (~4,000 sites) introduces copy regressions | Medium | Low | Codemod, not hand-editing; snapshot both locales before and after; keep `useT` as the adapter so the change is reversible |
| R-7 | Supabase single-project ceiling reached faster than expected | Low | High | ADR-0002's numeric triggers already exist; instrument p95 now that alerting is landing |
| R-8 | Preview environments leak real data before protection is enabled | **Live today** | High | Phase 1 week 1 — this is why it is first |
| R-9 | Scope expansion into Library/Transport/Payroll before the core is complete | High | High | Explicit: no new modules until Phase 4 exits |

## 9.2 Acceptance criteria for "production-ready"

**Functional** — Every rendered control performs its labelled action · every form validates inline · every document the system configures can be printed · every entity has a detail page · every money movement produces a receipt and is reversible · every destructive action has a dry run or a typed confirmation.
**Non-functional** — p95 server render < 400 ms with the DB in-region · WCAG 2.2 AA with zero serious/critical axe violations · MFA enforced for admin roles · alerting on error rate and uptime with a named on-call · restore rehearsed and documented · E2E green on 5 journeys · CI blocking on typecheck, lint, unit, pgTAP, a11y, prod-dep audit.
**Operational** — Runbook current · ADRs for every deferral with a numeric trigger · one-click rollback verified by `commit` in `/api/health` · migrations applied by pipeline, never by hand.

## 9.3 KPIs

| KPI | Baseline | Target |
|---|---|---|
| Screens with the full data-interaction contract | 1 / 44 | 14 / 14 list screens |
| `<Field>` call sites with inline validation | 0 / 197 | > 90% |
| Dead/disabled controls in production | 7 | 0 |
| Time to onboard 500 students | ~40 h manual | < 1 h by import |
| Time to mark one section's attendance | ~60 clicks | < 15 s keyboard |
| Time to enter marks for one section | ~60 Tab presses | < 90 s keyboard |
| SMS billing accuracy | operator-typed | system-resolved, 100% |
| Serious/critical axe violations | unmeasured | 0 |
| p95 server render (in-region) | ~200 ms cross-region penalty | < 400 ms total |
| MTTD for a production error | user-reported | < 5 min (alerting) |
| E2E journey coverage | 0 | 5 |
| Overall readiness score | 73 | 95 |

---

# 10. Appendices

## Appendix A — Screen capability matrix

Generated 2026-07-31 by per-file inspection of all 44 implementations. `—` = capability absent.

| Implementation | URL state | Page | Sort | Select | Export | Live | Modal | SaveBar | Skel | Empty | Error |
|---|---|---|---|---|---|---|---|---|---|---|---|
| teacher/list · **ListScreen** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ |
| fee/delete-fees | — | ✅ | — | ✅ | — | — | ✅ | — | ✅ | ✅ | ✅ |
| fee/digital-collection | — | ✅ | — | — | ✅ | — | — | — | ✅ | ✅ | ✅ |
| sms-notice/history | — | ✅ | — | — | ✅ | — | — | — | ✅ | ✅ | ✅ |
| core/user-list | — | ✅ | — | — | ✅ | — | — | — | ✅ | ✅ | ✅ |
| core/audit-log | — | ✅ | — | — | — | — | ✅ | — | — | — | ✅ |
| sms-notice/notice-board | — | ✅ | — | — | — | — | — | — | — | ✅ | — |
| fee/income-statement | — | — | — | — | ✅ | — | — | — | ✅ | — | ✅ |
| fee/unpaid-section · unpaid-institute | — | — | — | — | ✅ | — | — | — | ✅ | ✅ | ✅ |
| student/reports-summary | — | — | — | — | ✅ | — | — | — | ✅ | ✅ | ✅ |
| student/MigrationRunner | — | — | — | ✅ | — | — | — | ✅ | ✅ | ✅ | ✅ |
| student/migration-pushback | — | — | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| student/update-basic | — | — | — | — | — | — | ✅ | — | ✅ | ✅ | ✅ |
| student/registration | — | — | — | — | — | — | — | ✅ | — | — | — |
| student/update-class | — | — | — | — | — | — | — | — | — | — | — |
| teacher/TeacherForm | — | — | — | — | — | — | — | ✅ | — | — | — |
| attendance/AttendanceMarker | — | — | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| attendance/report · analytics | — | — | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| exam/MarksEntry | — | — | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| exam/ResultProcessor | — | — | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| exam/ConfigTab · SettingsShell | — | — | — | — | — | — | — | ✅ | — | — | — |
| fee/quick-collection-form · list | — | — | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| fee/fee-mapping | — | — | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| certificate/BatchCreator · CertRecordForm · TemplateManager | — | — | — | — | — | — | — | — | — | ✅ | — |
| certificate/SettingConfig | — | — | — | — | — | — | — | — | — | — | — |
| sms-notice/send | — | — | — | — | — | — | — | — | — | — | — |
| sms-notice/templates · balance-purchase | — | — | — | — | — | — | — | — | ~ | ✅ | — |
| core/basic-config · startup | — | — | — | — | — | — | — | ✅ | ✅ | — | — |
| core/class · signature | — | — | — | — | — | — | — | — | — | ~ | — |
| core/subject · subject-group · grading | — | — | — | — | — | — | ✅ | — | — | ✅ | — |
| dashboard/overview | — | — | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| edusathi | — | — | — | — | — | — | — | — | — | ✅ | — |

**Totals:** URL state 1 · pagination 6 · sort 1 · selection 3 · export 8 · live region 1 · skeleton 22 · empty 25 · error 21.

## Appendix B — Route → implementation map (multi-route components)

| Component | Routes served |
|---|---|
| `AttendanceMarker` | `/attendance/section`, `/exam`, `/update-section`, `/update-exam` |
| `MarksEntry` | `/exam/mark-input`, `/mark-update` |
| `ResultProcessor` | `/exam/result-process`, `/result-sheet-download` |
| `ConfigTab` | `/exam/mark-config`, `/marksheet-config`, `/comment-config`, `/date-config` |
| `MigrationRunner` | `/student/migration-merit`, `/migration-nomerit` |
| `TeacherForm` | `/teacher/registration`, `/update-profile` |
| `BatchCreator` | `/certificate/id-card`, `/admit-card` |
| `CertRecordForm` | `/certificate/testimonial`, `/transfer` |
| `SettingConfig` | `/certificate/admit-instruction`, `/exam-essentials` |

## Appendix C — Prior documents superseded or extended

| Document | Relationship |
|---|---|
| `docs/ENGINEERING_AUDIT.md` (2026-07-25) | Baseline. Its Phase 1–4 items re-verified closed. Its three open owner actions are carried into Phase 1 here |
| `docs/ARCHITECTURE_AUDIT.md` | Baseline for the layering and API-tier findings |
| `docs/ui-ux-audit.md` (2026-07-12) | Superseded — its Phase 2/3 dispositions all landed |
| `final_admin.md` (2026-07-26) | Superseded — all six phases implemented; the IA it specifies is what §2.3 assesses |
| `docs/adr/0001–0003` | Standing. This report's Phase 4 supplies the triggers ADR-0001 and ADR-0003 were waiting on |
| `docs/RUNBOOK.md` | Extended by §5.6.7 (deployment checklist) |

## Appendix D — Glossary

**RLS** Row-Level Security · **RPC** Remote Procedure Call (a Postgres function exposed over PostgREST) · **RSC** React Server Component · **PPR** Partial Prerendering · **OCC** Optimistic Concurrency Control · **TC** Transfer Certificate · **GPA** Grade Point Average (5.0 scale in Bangladesh) · **UCS-2** the 16-bit encoding SMS uses for non-Latin scripts (70 chars/segment vs GSM-7's 160) · **`bom1`** Vercel's Mumbai region · **`ap-south-1`** AWS/Supabase Mumbai region.

---

*End of report — EFB-SRA-2026-07-31 v1.0*

