# EduFusionBD — Requirements Analysis: Auth · Dashboard · Reports

**Date:** 2026-08-01 · **Scope:** the three surfaces flagged for redesign
**Method:** read every implementing file; every finding cites the line that proves it.
Findings are rated **P0** (ships a falsehood or blocks a user), **P1** (fails a real
workflow), **P2** (polish).

A note on what this report will not do: it does not call a screen "outdated" and stop
there. Where the complaint is aesthetic the finding names the specific decision that
dates the screen, so the fix is verifiable rather than a matter of taste.

---

# Part A — Authentication

Nine files: `RoleSelect` → `/login` → (`/2fa`) → role home, plus `/forgot-password`,
`/reset-password`, `/change-password`, `/first-login-setup`, `/otp`.

## A-1 · `first-login-setup` discards everything the user types — **P0**

`src/app/(auth)/first-login-setup/page.tsx`:

```ts
async function finish() {
  setSaving(true);
  await new Promise((r) => setTimeout(r, 700));
  router.replace(roleHome(null));
}
```

Three steps collect a display name, a new password (validated against `isAcceptable`,
confirmed twice, with a live requirements checklist) and preferences. `finish()` waits
700 ms and navigates. **No Supabase call. Nothing is saved.**

The user is told "Set up your account", chooses a password, sees it accepted, and still
has their provisioned temporary password. They will then fail to sign in with the
password they just chose, and — see A-2 — may have no way to recover.

This is the same defect class the project already fixed on `/otp`, where an identical
`setTimeout(700)` + `roleHome(null)` stub was removed and replaced with an honest
"not wired" state. That fix did not reach this screen.

`roleHome(null)` also hardcodes the admin dashboard, so a parent completing setup lands
in the admin app and is bounced by middleware.

**Fix:** wire it to `auth.updateUser` + `fn_update_my_profile`, or take the `/otp`
route and make the screen honestly unavailable until it is wired. Do not ship a form
that accepts input it discards.

## A-2 · The primary identity has no recovery path — **P0**

The product's stated primary identifier is a mobile number. `/login` labels the first
field **"Mobile number"** with placeholder `+880 1712-345678`. `identity.ts` maps it to
a synthetic address:

```ts
if (isPhone) return `${digits.slice(-11)}@phone.edufusionbd.app`;
```

`/forgot-password` then refuses exactly those users:

```ts
if (isPhoneIdentity(email)) {
  setError("Password reset by email is only available for accounts with an email address.");
```

And `/otp` is disabled (`NEXT_PUBLIC_OTP_ENABLED=false`, confirmed unset→false in
production). So the default user — a parent or teacher who signed up with a phone
number — who forgets their password has **no self-service recovery whatsoever**. Their
only route is phoning the school and having an admin reset it manually.

This is not a missing nice-to-have; it is the recovery path for the majority identity
type, and it compounds A-1 (a user whose first-login password silently failed to save
is now locked out with no way back).

**Fix (no SMS provider required):** admin-initiated reset already exists in the data
model. Surface it — a "reset a user's password" action in Settings → Users, plus a
`/forgot-password` branch for phone identities that says *"Ask your school office to
reset it"* and names the institution's contact number, instead of a dead end. The real
fix is the SMS provider (Phase 4 W13), but the dead end is fixable now.

## A-3 · Role selection is decorative and costs every user a click — **P1**

`RoleSelect` asks "Who are you?" and routes to `/login?role=…`. The login screen's own
comment concedes the answer is ignored:

```ts
// Role the user picked on the Role Selection screen — drives the header only.
// The signed-in JWT role (below) is authoritative for where they actually land.
```

So choosing "Parent" and signing in with an admin account lands on the admin dashboard.
The screen adds a mandatory step to **every** sign-in, on a product whose users sign in
from low-end phones on slow connections, and changes nothing but a subtitle.

**Fix:** delete the interstitial; make `/` the login screen. If the role hint has
marketing value, keep it as three links *below* the login form rather than in front of
it. This removes a screen, a route and a class of confusion.

## A-4 · Validation is a single summary box, not field-level — **P1**

Every auth screen renders one error region at the form foot:

```tsx
{error ? <p className="…text-danger-fg" role="alert">{error}</p> : null}
```

No input receives `aria-invalid`, and none is linked by `aria-describedby`. On
`/reset-password` and `/change-password` — three password fields each — "That password
does not meet the requirements" does not say *which* field, and a screen-reader user
gets an alert with no association to the control that caused it.

This is finding **F-1** of the project's own `SYSTEM_REQUIREMENTS_ANALYSIS.md`
("0 of 197 `<Field>` call sites pass `error`") reproduced on the auth surface. The
`Field` primitive already supports it; the auth screens do not use `Field`.

**Fix:** route auth inputs through the shared `Field`, passing `error`. Cheap, and it
closes a WCAG 3.3.1 gap at the same time.

## A-5 · `change-password` re-authenticates by replacing the session — **P1**

```ts
const { error: reauthErr } = await supabase.auth.signInWithPassword({
  email: user.email, password: current,
});
```

Verifying the current password by calling `signInWithPassword` issues a **new session**
as a side effect. On failure the user has burned a rate-limit slot against their own IP
(the login screen's own comment documents Supabase 429s here). It also means a wrong
current-password guess is indistinguishable, in the auth logs, from a login attempt.

**Fix:** Supabase exposes reauthentication (`auth.reauthenticate()`) for precisely this.
Failing that, attempt `updateUser` and classify the error rather than minting a session.

## A-6 · "Remember me" does nothing — **P2**

The code says so:

```ts
// ponytail: @supabase/ssr persists the session in cookies regardless of
// `remember`, so the toggle is a UX affordance today.
```

A checked-by-default control that does not do what it says is the dead-control defect
(**F-3**) in miniature, on the most-seen screen in the product.

**Fix:** wire it to a session-scoped cookie, or remove it. Do not ship it checked.

## A-7 · What actually dates the design

The palette is not the problem — `--color-interactive-primary: #4f46e5` is a
defensible indigo and the token architecture (raw Figma vars → `@theme inline`
semantic utilities, dual-mode, contrast-tested) is genuinely good and should not be
thrown away. Four specific decisions date the screen:

| # | Decision | Why it reads as 2021 | Direction |
|---|---|---|---|
| 1 | **Animated 3-glow gradient mesh rail** (`.auth-rail`, 28 s drift) | The gradient-mesh hero was the defining SaaS trope of 2021-22 and now reads as template. It is also 44% of the viewport spent on decoration. | Reduce the rail to ~36%, drop the drift animation, replace the mesh with a flat deep-ink field and one restrained accent — or with real product content (a screenshot, a metric, an actual school name). |
| 2 | **Generic feature bullets** — three white/10 pills with check icons | Says nothing a competitor's page doesn't. Checkmark-pill lists are visual filler. | Replace with one concrete proof: "৳" collected this month across N schools, or a named institution. If there is no such proof yet, show nothing — whitespace outperforms filler. |
| 3 | **`rounded-3xl` card + `shadow-e2` floating on a tinted canvas** | The floating-card-on-gradient pattern. Modern auth is flatter and tighter — the form sits *on* the surface, not on a card on a surface. | Drop the card container on desktop; keep the 480 px measure. Retain the card on mobile where there is no rail behind it. |
| 4 | **`text-h1: 2.5rem` headline + 9-unit letter tile** | The "E" in a gradient rounded square is the default AI-generated-logo look. | A real wordmark. This is a branding task, not a CSS one, but the placeholder should not ship to a defence. |

Note the constraint that must survive the redesign: the rail palette is deliberately
scoped to `.auth-rail`/`.auth-mark` so it does not move `--color-interactive-primary`,
which `tests/contrast.test.ts` and ~110 admin screens are written against. Any repaint
stays inside that scope.

## A-8 · Teacher role has no app — **P1 (architectural)**

```ts
const HOME: Record<Role, string> = {
  teacher: "/admin/dashboard", // teacher app not built yet → admin fallback
```

A teacher signing in gets the full admin shell. RLS and `fn_my_permissions` gate the
*data*, and the rail filters by permission, so this is not a security hole — but the
IA is wrong: a teacher sees Fees, Documents and Settings entries as their home. Given
the roster now has 268 students and 3 teachers, teacher-facing attendance and marks
entry is the highest-leverage missing surface in the product.

---

# Part B — Admin Dashboard

`OverviewScreen.tsx` (714 lines) + `logic/api.ts`. This screen has already had one
honesty pass — the fabricated greeting, invented attendance chart and made-up ৳ alerts
are gone, and every element is now bound to a live query. The findings below are about
what it does *not* yet answer.

## B-1 · The most urgent daily number is absent — **P1**

A school administrator's first question every morning is **"who is absent today?"** The
dashboard cannot answer it. `fetchDashboard` aggregates a 30-day attendance trend and
`fetchPeriodStats` a period rate; neither surfaces *today*. There is no "attendance not
yet taken for N sections" prompt either, which is the actionable form of the same
question — and with 9 class-sections that is a 9-item checklist an operator could clear
before 10 a.m.

`v_attendance_daily_summary` already exists to serve this.

## B-2 · Recent activity renders raw database tokens — **P1**

```tsx
<b className="font-semibold">{a.action}</b> · {a.entity}
```

`audit_log.action` and `.entity` are machine values. The panel reads
`INSERT · student`, `UPDATE · fee_invoice` — untranslated in both locales, with no
actor, no target and no link. On a Bengali-first product this panel is English
database jargon. The timestamp is `n(localDay(a.at))` — a date with no time, so six
entries on the same day all read identically.

**Fix:** map action×entity to a bilingual sentence ("রাকিব হাসান কে যোগ করা হয়েছে"),
show the actor, show relative time, link to the record.

## B-3 · The "needs attention" rules are hardcoded and there are only three — **P1**

`api.ts` builds `attention` from exactly three conditions: overdue fees, 30-day
attendance below 75%, exams locked-but-unpublished. Adding a fourth requires a code
change and a deploy. Absent and material for this school right now:

- **sections with no class teacher** — `class_section.class_teacher_id` is nullable and, with 3 teachers across 9 sections, mostly null
- **students with no guardian contact** — blocks every SMS the school sends
- **attendance not taken today**
- **incomplete student records** — 268 students currently carry placeholder DOBs (see C-6)

## B-4 · Everything is institution-wide; there is no drill-down — **P2**

Every number is a single institution-level figure. With 9 class-sections a head teacher
cannot see which class is dragging attendance down without leaving for another screen.
The KPI tiles link to lists (good, and a deliberate earlier fix), but the charts do not
segment.

## B-5 · The period selector governs two panels and looks like it governs the page — **P2**

This is *documented* as deliberate and the reasoning is sound (enrolment counts are
point-in-time; a selector that appeared to filter them would report a falsehood). But
the control sits under a heading — "Over a period" — placed *above* the two panels it
governs and *below* the three KPI tiles it does not, and the fee tile it *does* govern
sits in the group it does not. Correct behaviour, ambiguous layout.

**Fix:** move the fee tile into the period group, or visually bind the selector to its
two panels with a shared container.

## B-6 · Charts are a 7-point bar and a donut — **P2**

`BarChart` and `Donut` are the only two primitives in `shared/ui/Chart.tsx`. The
attendance panel plots `trend.slice(-7)` labelled by weekday — correct for "last 30
days", but for "this year" it is seven arbitrary consecutive days presented as the
year's picture.

## B-7 · No "as of" timestamp — **P2**

TanStack Query runs `staleTime: 60_000` and the router cache holds 30 s, so a
displayed figure can be ~90 s old with no indication. On a money tile that matters.

---

# Part C — Reports

## C-1 · "Reports" is one screen about students — **P0 for the module's premise**

`ADMIN_NAV_ZONES` gives Reports its own zone ("Insights") and its own rail entry. It
points at `/admin/student/reports-summary` — **the same route** as the Students module's
"Reports" tab. One screen, two nav entries, presented as a module.

That screen answers exactly one question: *what is the demographic shape of our
enrolment?* Everything else a school reports on is either missing or filed under the
module that produces it, not under Reports:

| Domain | Data that exists | Report surface today |
|---|---|---|
| Academic results | `exam_result`, `mark`, `grade_scale`, `fn_exam_tabulation`, `v_effective_subject_marks` | **none** |
| Attendance | `v_attendance_daily_summary`, `v_attendance_student_summary`, `v_attendance_trend`, `fn_attendance_summary` | under Attendance |
| Finance | `fn_fee_income_statement`, `fn_fee_day_book`, `fn_unpaid_by_institute`, `v_fee_invoice_balance`, `ledger_entry` | under Fees |
| Staff | `teacher`, `teacher_assignment`, `designation`, `department` | **none** |
| Communications | `v_sms_campaign_summary`, `fn_sms_campaign_totals`, `sms_recipient` | under Communication |
| Compliance | `audit_log`, `access_log`, `export_log` | audit log under Settings |

The backend for a real reports module is largely **already built**. What is missing is
the surface that gathers it.

**The single highest-value gap: there is no academic performance report.** A school
information system that cannot produce a grade distribution, a pass/fail rate, a
subject-difficulty comparison or a class-vs-class ranking is not yet doing the job its
users bought it for — and `fn_exam_tabulation` and `grade_scale` are sitting there.

## C-2 · The one report has no filters — **P0**

`ReportsSummaryScreen` calls `useStudentReport()` with no arguments. There is no class
filter, no section filter, no shift filter, no gender/religion filter, no date range,
no academic-year selector on the screen itself. It returns the whole institution for
the current year, always.

A user who wants "girls in Class FIVE" — now a real question, that is one of 9 sections
— cannot ask it. Contrast with the Teacher Directory, which the project's own audit
names as the reference screen for the data-interaction contract (filter → URL state →
paginate → export). Reports implements none of it.

## C-3 · The export drops most of what is on screen — **P1**

```ts
exportCsv(`student-summary-${localDay()}.csv`, report.data.by_class.map((c) => ({
  Class, Sections, Boys, Girls, Total })))
```

The screen displays four KPIs, a gender ratio, a status distribution, a religion
breakdown and an age breakdown. The export contains **only the class table**. A user
who exports "the report" gets a fraction of it and has no way to know what was dropped.

## C-4 · Exports of student PII are unlogged — **P1 (compliance)**

`export_log` exists in the schema, is typed in `database.types.ts`, has RLS, and has
**zero rows** — because no application code writes to it:

```
grep -rn "export_log" src → only database.types.ts
```

Every CSV export across all 19 screens that call `exportCsv` — including full student
rosters with guardian mobile numbers — leaves no record of who exported what, when.
The table was purpose-built for this and never wired. For a system holding 268 minors'
records, that is the gap most likely to matter to a regulator.

## C-5 · No print output, though print is the actual deliverable — **P1**

`globals.css` ships a considered print stylesheet (`@page { margin: 12mm }`, chrome
hidden, `data-print="sheet"` promotes a container to the page). Exactly **one** screen
uses it — Day Book. Bangladeshi schools submit printed returns; a reports module whose
output cannot be handed to a managing committee is incomplete.

## C-6 · The age distribution is about to display nonsense — **P0, live now**

The 268-student roster loaded on 2026-08-01 carries `dob = 1900-01-01` (flagged
`metadata.dob_missing = true`) because the source sheet had no date of birth. The
report buckets ages into `5-8 / 9-11 / 12-14 / 15-17 / other`. Every one of those
students is now 126 years old and lands in **"other"**.

The Age Distribution card will render a single bar reading *Other — 268 (100%)*,
presented in the same styling as the genuine class and gender breakdowns beside it. The
report has no notion of "not recorded" versus "recorded as other", so a data gap is
rendered as a finding.

**Fix:** exclude `dob_missing` rows from the age aggregation and show an explicit
"date of birth not recorded for N students" note. Data quality must be visible *as*
data quality, never laundered into a category.

## C-7 · Nothing is scheduled — **P2**

Every report is pull-only. There is no weekly digest, no month-end statement, no
emailed attendance summary. `pg_cron` is scheduled for Phase 4 W12 and is the natural
home.

---

# Prioritised backlog

| # | Finding | Rating | Cost |
|---|---|---|---|
| 1 | A-1 first-login discards password | P0 | S |
| 2 | C-6 age report renders placeholder DOBs as a finding | P0 | S |
| 3 | A-2 phone identity has no recovery path | P0 | S (dead-end copy) / L (SMS) |
| 4 | C-2 reports have no filters | P0 | M |
| 5 | C-1 no academic performance report | P0 | L |
| 6 | C-4 exports unlogged | P1 | S |
| 7 | B-2 activity feed shows raw DB tokens | P1 | S |
| 8 | A-4 field-level validation | P1 | M |
| 9 | A-5 reauth mints a session | P1 | S |
| 10 | B-1 today's attendance absent | P1 | M |
| 11 | C-3 export drops most of the report | P1 | S |
| 12 | A-3 delete the role interstitial | P1 | S |
| 13 | A-6 remember-me is decorative | P2 | S |
| 14 | B-3 attention rules hardcoded | P1 | M |
| 15 | A-7 auth visual redesign | P2 | M |
| 16 | C-5 print output | P1 | M |

**Sequencing note:** items 1, 2, 3, 6, 7, 9, 11, 13 are all **S** and independently
shippable. They are the correct first commit — every one removes something the product
currently states that is not true.
