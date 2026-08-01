# SRA implementation log

Execution record for `docs/SYSTEM_REQUIREMENTS_ANALYSIS.md` (EFB-SRA-2026-07-31).
One section per phase. Each entry states what landed, and — where the report's
recommendation was not followed literally — why.

Status legend: **DONE** · **PARTIAL** (what is missing is stated) · **OWNER**
(needs an account, a dashboard toggle or a contract — not an engineering task).

---

## Phase 1 — Integrity & honesty · **DONE** (code) · target 73 → 80

### Week 1 — `92f7d67`

| SRA item | Status | Note |
|---|---|---|
| `vercel.json` region `bom1` (5.6.1) | DONE | Functions ran in `iad1` while Supabase is `ap-south-1` |
| CI gates deploy (5.6.3) | DONE | `verify/rls/audit` → `migrate` → `vercel build+deploy --prebuilt` → `/api/health` smoke against `$GITHUB_SHA` |
| `supabase db push` job (5.6.4) | DONE | Runs before the app deploy on `main` |
| Delete the 7 dead controls (A-0.3) | DONE | 5 removed outright, 2 "(soon)" buttons → one info strip each |
| Teacher row-action id (A-3.1) | DONE | `?id=` is now URL-backed, so an open profile is linkable too |
| `hasSubjects` hardcoded (A-1.7) | DONE | Head-only count |
| Centralise timezone formatting (A-0.8) | DONE | `shared/lib/format.ts`, institution-time |
| Error alerting (5.6.5) | DONE | `OBSERVABILITY_ALERT_URL` — see the Sentry note below |
| `commit` in `/api/health` | Already present | Verified, not re-done |
| Deployment Protection on previews (5.6.2) | **OWNER** | Vercel dashboard checkbox. Live risk R-8 until set |
| Skew Protection | **OWNER** | Vercel dashboard |
| Log drain + uptime monitor | **OWNER** | Needs a vendor account; the endpoint and log shape are ready |

**Sentry (5.6.5).** Not installed. The report names Sentry; what it *asks for* is
that something alerts. `@sentry/nextjs` is a build plugin, three config files, a
sourcemap auth token and ~40 kB of client runtime, all to reach an endpoint
`fetch` already reaches — and it needs a DSN that does not exist. Unhandled
errors now POST the already-PII-scrubbed JSON line to `OBSERVABILITY_ALERT_URL`
(a Slack/Discord webhook, Better Stack, Axiom — the owner's choice, no code
change). If the project later wants Sentry's grouping and release UI, install
the SDK and delete `alertTransport`; the `instrumentation.ts#onRequestError`
funnel is unchanged either way.

### Week 2 — `f8bf5c8`

| SRA item | Status | Note |
|---|---|---|
| F-2 SMS recipient resolver + encoding-aware segments | DONE | Resolution and billing moved into Postgres; `recipient_count` is now an output, not an input |
| F-5 merit rank from `exam_result` + dry run | DONE | Merit promotion requires an exam; refuses while any selection is unprocessed |
| Grading-scheme range validation (A-9.1) | DONE | Overlaps, holes, inverted bands, 0–100 coverage, "nobody could pass" |
| Marks full-marks from `mark_config` (A-5.1) | DONE | subject → mark_config → 100, read-only, source stated |
| Fee idempotency + over-payment guard (A-6.1) | DONE | Partial unique index; over-payment refused up front instead of silently capped |

### Week 3 — `d6d5e3b`

| SRA item | Status | Note |
|---|---|---|
| Inline validation on the 5 highest-traffic forms (A-0.2 / F-1) | DONE | Admission (30 fields), Teacher onboarding (31), Fee collection, Marks Entry, Basic Config |
| Unsaved-changes guard (A-0.6) | PARTIAL | `beforeunload` covers tab close/reload/external nav. In-app `<Link>` is **not** covered: the App Router exposes no cancellable route-change event and every workaround patches router internals. Autosave is the complement |
| Autosave on Marks Entry + Attendance (A-0.6) | DONE | Debounced `localStorage`, keyed by the work; restore is always an explicit prompt |
| Attendance "already taken" banner (A-4.2) | DONE | Names who took it and when |
| Attendance SMS preview (A-4.5) | DONE | Message text, absentee count, segments × recipients, balance |

**React Hook Form (5.2).** Not added. §5.2 calls it the highest-value dependency
addition; A-0.2 asks for a ~25-line `useZodForm`. The two recommendations differ
and the second is the right one here: 197 `<Field>` sites already wrap
*controlled* inputs driven by a `useState` object and an `up(k, v)` setter. RHF's
value is uncontrolled `register()` inputs, so adopting it means rewriting the
state wiring of 44 screens to gain re-render performance nothing currently
needs. `shared/lib/useZodForm.ts` is ~90 lines and no dependency. If a
marks-style grid ever profiles badly, reach for RHF *there*.

### Out of scope of the SRA, found during Phase 1 — `0ec3802`

Re-running the Supabase advisors and verifying each finding against the live API
turned up an **unauthenticated cross-tenant read** the report does not contain.
`v_attendance_daily_summary`, `v_attendance_student_summary` and
`v_attendance_trend` lacked `security_invoker`, so
`GET /rest/v1/v_attendance_student_summary` returned every institution's
per-student attendance rate to anyone holding the anon key that ships in the
client bundle. Verified HTTP 200 with real rows before the fix, `[]` after.

Also closed: partitions of `attendance`/`mark` had RLS off and client SELECT
grants (latent — PostgREST omits partitions from its schema cache today, but
that is a PostgREST behaviour, not an authorization control), the trigger that
re-created that gap every academic year, and 48 `fn_*` executable by `anon`.

The last one is worth remembering: the first revoke targeted `anon` and changed
nothing, because the grant was `=X/postgres` — to **PUBLIC**, which every role
inherits. The check has to be the ACL, not the statement you ran. 8 pgTAP
assertions added (plan 40 → 48).

**The SRA's "RLS on 86/86 tables" counts parent tables.** Treat that figure as
covering the tables someone wrote a policy for, not the tables PostgREST can
address.

### Phase 1 exit criteria

| Criterion | Met |
|---|---|
| Zero dead controls | ✅ |
| Zero screens billing against operator-typed numbers | ✅ |
| Inline validation on the 5 forms | ✅ |
| CI gates production | ✅ (needs the Vercel Ignored Build Step set — OWNER) |
| Alerting live | ✅ once `OBSERVABILITY_ALERT_URL` is set — OWNER |
| Sub-100 ms server-to-DB latency | ✅ by placement (`bom1`); unmeasured until deployed |

---

## Phase 2 — The operating surface · **DONE** (code) · target 80 → 86

### Week 4 — `2c21cdd`, `f617439`

| SRA item | Status | Note |
|---|---|---|
| Extract `useDataScreen` from the Teacher Directory (A-0.1) | DONE | A hook + `DataToolbar`, not a `<DataTable>` — composition over configuration; a 40-prop table is how design systems die |
| Migrate the first 4 list screens | DONE | Teacher Directory (first, deliberately — proves the extraction against the one screen that was already correct), quick-collection-list, sms history, digital-collection |

`applyClientList()` gives the same contract to screens that already hold a
bounded set. Explicitly not for unbounded data: a table that only grows must
page on the server, or "export all" silently exports page 1.

### Week 5 — `bc8158a`, `05a6519`, `9134402`, `f4db94e`

| SRA item | Status | Note |
|---|---|---|
| Remaining 10 list screens (A-0.1) | DONE | update-class, unpaid-section, unpaid-institute, audit-log, delete-fees, attendance report + analytics, update-basic, notice-board. 14 of 14 — User Management is the 14th and Week 6 rebuilt it |
| `useGridNavigation` for Marks Entry + Attendance (A-0.7) | DONE | Arrows, Enter-as-next-row, select-on-land; attendance gets `1..4`. Not a full ARIA grid — Tab already means something correct in a table of real inputs |
| 9 `<div>` tables → `shared/ui/Table` (A-0.7) | DONE | 10 tables across 8 screens: class sections, subjects, grading (list + editable bands), fee mapping, the 3 income-statement ledgers, migration pushback, class distribution |

**Three defects found while migrating, none in the report.**

- **Audit Log threw on render.** `AUDIT_ENTITIES` listed 22 entities, `ENTITY_LABEL`
  held 6, and the `<option>` list read `.bn` without the `?.` the row rendering
  had. Dead since the entity list grew past `migration_batch`.
- **Attendance Analytics threw on load, on its own default.** `fn_attendance_summary`
  has read `p_class_section_id is null or …` since it shipped — null means
  institution-wide — but the fetcher refused to send null. Fixed at the guard,
  not at the screen, because the Report screen shares that fetcher.
- **A ninth dead control** (the report listed seven; Week 4 found the eighth):
  Analytics' per-row SMS button was `disabled` unconditionally.

`fn_attendance_summary` gained `student_id`. It returned a row per student and
no way to address one — `student_code` is a display string, nullable for anyone
registered before codes were minted — so no roster could be linked out of.

`useDataScreen` gained `setFilters()`. Two `setFilter` calls in one handler do
not compose: each rebuilds the query string from the same render's
`searchParams`, so the last wins and the others vanish silently. Every
date-range Search button applies three keys at once.

### Week 6 — `0fea1de`, `26e96dc`

| SRA item | Status | Note |
|---|---|---|
| User Management v2 (A-0.4 point 3) | DONE **except invite** | Role assignment, suspend/reactivate, last sign-in, full A-0.1 contract |
| Permission Matrix (A-0.4 point 4) | DONE, read-only | See below |
| Populate `AdminModule.roles` (A-0.4 point 2) | DONE, as `permission` | See below |
| Human-readable acting role (A-0.4 point 5) | DONE | Was `me.role.replace(/_/g, " ")` — the raw enum, in English, on a Bangla-only product |

**Invite is not built, and the screen says so.** Creating a Supabase Auth user
needs the **service-role key**, which cannot exist in a browser bundle. That is
a server route with its own rate limit and audit trail, and it belongs with the
Phase 3 auth work (MFA, session management, My Account) rather than bolted onto
a list screen. Suspension covers the operational need in the meantime; delete
is deliberately absent because a profile carries audit attribution.

**The Permission Matrix is read-only, deliberately.** The four roles are
`is_system` rows and every RLS policy and RPC guard in the product is written
against their codes. An editable grid that lets an operator untick
`dashboard.view` from `institution_admin` locks the school out of its own
product in two clicks with no undo. Custom roles are the feature that makes
editing safe, and they are not built.

**`roles` became `permission`.** The report says "populate `AdminModule.roles`";
that field was typed against the JWT enum (`admin | teacher | parent | student |
super_admin`) — a vocabulary the database never shared, which is why nothing
ever set it. The rail now filters on **permission codes**, the same ones RLS and
the RPC guards use, so navigation and authorization agree by construction
instead of by two lists someone must remember to sync. It **fails open**:
`undefined` (loading) and `[]` (an account whose `user_role` rows were never
seeded) both show everything, because an empty rail reads as a broken product
rather than as an access decision — risk R-5 exactly. RLS is the control; the
rail is only the map.

### Week 7 — `e5283f8`

| SRA item | Status | Note |
|---|---|---|
| Student Profile + Teacher Profile detail pages | DONE | Read-only, link out rather than duplicate; both link to the Audit Log filtered to that record, which is the per-record timeline A-2.2 says is missing |
| Global entity search in `⌘K` | DONE | Screens resolve locally and instantly; people are a debounced query appended below them |
| Dashboard KPI drill-down | DONE | Every tile opens the list it summarises; the collection tile opens the income statement for exactly its window |
| Dashboard period selector | DONE, scoped | See below |

**The period selector governs two panels and one tile, not the whole screen.**
Money collected and attendance are functions of a date range. Enrolment counts,
teacher counts and outstanding dues are point-in-time facts, and a control that
appeared to filter them would be reporting a falsehood — which is the exact
defect the dashboard rebuild set out to remove ("every element is bound to real
data, or it does not ship"). The period query is separate from the main payload
so the server prefetch (audit H-5) keeps a constant cache key.

### Phase 2 exit criteria

| Criterion | Met |
|---|---|
| 14 list screens with the full contract | ✅ |
| RBAC usable end to end | ✅ for assignment, suspension and visibility; **invite is Phase 3** (service-role key) |
| Every stored entity has a detail page | ✅ students and teachers |

### Verification

`tsc --noEmit` clean · `eslint` clean · **290 tests, 24 files, all passing** ·
`next build` clean with all three new routes emitted. Not exercised against a
live database or a browser session — the Supabase project and a signed-in
operator are needed for that, and the migrations in this phase
(`20260731100000`, `20260731110000`) have not been pushed.

---

## Phase 3 — Artefacts, auth & completeness · **DONE** (code) · target 86 → 91

Weeks 8–10 are recorded in their own commits (`e6c37e3`, `e04b272`, `dfcdd79`,
`070e48a`) and the commit bodies carry the reasoning; this entry covers week 11
and the two pieces of work requested alongside it.

### Week 11 — Import + the Academic Calendar

| SRA item | Status | Note |
|---|---|---|
| Import Wizard + Students / Teachers / Marks importers (A-0.5) | DONE | One `<ImportWizard>`; the three modules differ only in an `ImportSpec` |
| Academic Calendar + terms (A-4 item 3 / portfolio #7) | DONE | Month grid, range editor, terms panel; attendance now says when a date is not a teaching day |

**The importer validates twice, and neither pass is redundant.** The client runs
the module's own zod schema so the operator sees "line 47: guardian_mobile must
be 01XXXXXXXXX" before anything is written; the RPC re-checks what only the
database can know — does this class exist, is this roll taken, is this student
already enrolled. Dropping the first would discover a 500-row file's problems
one round trip at a time. Nothing is written before the preview: an import that
half-lands and reports a number is how a school ends up with 40 duplicate
students and no way to tell which.

Dates are the part that bites. A Bangladeshi office machine writes `dd/mm/yyyy`,
and casting that to a `date` column silently produces the wrong day for the
first twelve of every month and an error for the rest. Normalised at the field
boundary, so a birth date is either right or rejected by name.

Marks are keyed by **roll number**, resolved server-side against the chosen
section, and full marks are deliberately not a column — `mark_config` decides
them (A-5.1 item 1). A sheet that says 100 for a subject configured at 50 is
exactly how a section's GPA goes wrong with nothing to catch it.

**A defect in the calendar migration, found before it ran.** `fn_calendar_day`
was written to read `basic_config.weekly_holidays` as an array of weekday
numbers. Basic Config has never stored that: it stores `weekend` as one of three
tokens (`fri_sat`, `sat_sun`, `fri_only`). The lookup would have missed on every
institution and fallen through to the hardcoded Friday default — correct for
most Bangladeshi schools, which is precisely why nobody would have reported it,
and wrong for every school that had set the field. Now reads the real key.

Non-working days are excluded from `fn_attendance_summary`'s denominator **and**
its per-student totals. `working_days` counted distinct dates on which somebody
was marked, so taking attendance once by mistake on Eid made that day a working
day for the whole institution and dragged every rate down.

The attendance banner **warns, it does not block**. The calendar has an explicit
override in both directions — a make-up class on a Friday is a working day — but
a school whose calendar is not yet filled in must still be able to mark a
register at 8am. Locking the highest-frequency operation in the product on a
settings gap is risk R-5, the same reasoning that makes the navigation rail fail
open.

### Dashboard — the A-1 residue

| A-1 item | Status | Note |
|---|---|---|
| 3 · role-aware sections | DONE | Was blocked on A-0.4, which landed in P2 w6 |
| 8 · period-over-period delta | DONE | Forecast and seasonality are not built |
| 4 · customisation · 6 · configurable thresholds | Not attempted | P2; item 3 covers the actual complaint far more cheaply |
| 9 · EduSathi prompt bar | **Deliberately not built** | See below |

Tiles, panels, quick actions and attention rows filter on the same permission
codes as the rail and RLS, and fail open the same way. A quick action pointing
at a screen the operator's role cannot open is a dead control with a redirect on
the end of it.

The delta compares against the preceding window **of equal length** — a custom
9-day range against a 30-day one produces a −70% that means nothing and that a
head teacher would act on — and renders nothing at all when the baseline window
is empty, because against zero every change is "+100%".

**Item 9 is the one recommendation in this phase that was refused.** EduSathi v1
is Phase 4 week 15. A prompt bar shipped now carries a typed question to a
screen that says "coming soon" — the dead-control defect Phase 1 exists to have
removed, placed on the surface every operator sees every morning. The
positioning argument in A-1 is correct; the answer to it is to ship the
assistant, not a door with nothing behind it.

### Auth — the palette redesign

§4.4's palette row said "unchanged", and §4.1's argument for that still holds:
the auth module's real problem was functional incompleteness, and weeks 8–10
closed it. The repaint was asked for again afterwards, so it was built.

**Scoped, not global.** The flat `bg-primary-hover` fill — a single solid
indigo, which is the specific thing that reads as dated — became a three-glow
mesh in `.auth-rail`, with `--auth-ink` and `--auth-glow-a|b|c` as its own
tokens. `--color-interactive-primary` did not move: it is bound by
`tests/contrast.test.ts` and used by 44 admin screens, and a sign-in page is not
a reason to migrate the product's primary. The whole change reverts by deleting
one CSS block.

Also landed from §4.4: `e1` on mobile / `e2` from `sm`, the 480px form-column
guard, a motion-safe card entrance, and per-role gradient chips on Role Select
(three identical indigo chips made one choice look like the same option three
times).

**Three claims removed from the sign-in rail.** The register carried A-4 for
one — offline attendance. Checked while editing the file, all three bullets were
undeliverable: the SMS gateway and the payment gateway are Phase 4 week 13,
EduSathi is week 15. The first screen an evaluator sees made three promises the
product could not demonstrate. Replaced with three that shipped.

**An accessibility defect found on the way.** Login, Forgot Password and
First-Login Setup each hand-rolled a copy of the shared text input, and all
three used `border-border-strong` — the token globals.css marks decorative-only,
which does not meet the 3:1 an interactive boundary owes under SC 1.4.11. Fixed
at the shared primitive rather than in three places: they now use `<Input>`,
whose `controlBase` uses `border-border-control`.

### Phase 3 exit criteria

| Criterion | Met |
|---|---|
| Every document the system configures, it can print | ✅ |
| MFA enforced for admin roles | ✅ |
| A school can onboard by import | ✅ |

### Verification

`tsc --noEmit` clean · `eslint --max-warnings=0` clean · **361 tests, 29 files,
all passing** · `next build` clean, with `/admin/core/calendar` emitted.

**Not verified in a browser.** The preview tooling in this session resolves its
launch config from the session's original project root, so every attempt started
a different repository's dev server on port 3000 regardless of the config name
passed. The two migrations added here (`20260801095000_bulk_import`,
`20260801096000_academic_calendar`) have **not been pushed** — and week 9's
experience says that matters: five unpushed migrations were what made those
screens render their error state, and running them is what exposed three defects
the SQL review had not.
