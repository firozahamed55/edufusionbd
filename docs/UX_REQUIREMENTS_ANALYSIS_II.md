# EduFusionBD — Requirements Analysis II: Auth · Dashboard · Reports

**Date:** 2026-08-01 · **Supersedes nothing; extends `UX_REQUIREMENTS_ANALYSIS.md`**
**Status of the first pass:** its eight **S**-sized findings shipped in `9b0c312`,
`37380e2` and `dede8b4`. This document covers what the first pass sized as **M**
and **L**, and goes considerably deeper on Dashboard and Reports — the first pass
audited what those two screens *say*; this one asks what they are *for*.

**Method.** For Auth, a design specification with a named rationale per decision.
For Dashboard and Reports, the analysis starts from the administrator's operating
rhythm rather than from the current screen, so that "what is missing" is derived
from the job rather than from the diff. Every capability claim is checked against
the live schema (86 tables, 9 views, 90 RPCs) and marked **exists** / **derivable**
/ **needs schema**.

---

# Part A — Authentication: redesign specification

The first pass established *what* dates the screen (A-7) and *what is broken*
(A-1 … A-6). This part is the specification for the replacement. Direction chosen:
**restrained institutional**.

## A.0 · What is not changing, and why

The token architecture stays. Raw Figma variables → `@theme inline` semantic
utilities → dual-mode with a contrast test (`tests/contrast.test.ts`) is better
than most production design systems and is load-bearing for ~110 admin screens.
`--color-interactive-primary: #4f46e5` does not move. The repaint is confined to
the `.auth-rail` / `.auth-mark` scope in `globals.css:300-349`, exactly as the
existing comment there requires.

The complaint "the colour palette looks outdated" is, on inspection, not about the
indigo. It is about **three glow layers, a 28-second drift animation, and 44% of
the viewport spent on decoration**. Gradient mesh is what reads as 2021, not the hue.

## A.1 · The specification

| Element | Now | Target | Rationale |
|---|---|---|---|
| Rail width | `44%` | `36%` (`lg`), `40%` (`2xl`) | The form is the task. A rail past a third of the viewport is a poster the user must look past. |
| Rail fill | 3 radial glows + `auth-rail-drift 28s` | Flat `--auth-ink` with **one** low-opacity accent wash, no animation | Removes the trope and the animation budget. A static field also removes a repaint loop on the low-end Android hardware this product targets. |
| Rail content | Headline + 3 check-pills + copyright | Headline + **one** proof block + copyright | The pills say nothing a competitor's page doesn't. §A.2. |
| Logo | `E` in a gradient rounded square | Wordmark lockup, mark reduced to a monoline glyph | The gradient letter-tile is the default AI-generated-logo look. Full brand work is out of scope; the placeholder should at least not signal "placeholder". |
| Card | `rounded-3xl` + `shadow-e2` on tinted canvas | Form sits **on** the surface at `lg`+; card retained below `lg` | The floating-card-on-gradient is the same 2021 vocabulary. On mobile there is no rail to float over, so the card earns its keep there. |
| Headline | `text-h1` (2.5rem) | `2rem`, tighter leading, `-0.02em` tracking | 2.5rem against a 36% rail wraps to four lines in Bangla. |
| Entrance | `auth-card-in` 320ms translateY | Retained, reduced to opacity-only | Vertical entrance on a form that may already be autofilled causes a visible jump. |
| Field errors | one summary box at the form foot | `Field` with `error`, `aria-invalid`, `aria-describedby` | A-4. WCAG 3.3.1. |

## A.2 · The proof block

The three feature pills are replaced by one statement that is **true and specific**.
Ranked by preference:

1. A live figure, if one can be computed without auth (it cannot today — every
   relevant view is RLS-scoped to a signed-in institution).
2. A named institution using the product.
3. **Nothing.** Whitespace beats filler.

Until (1) or (2) exists, ship (3): headline, one sentence of positioning, footer.
This is a smaller rail that says less and is therefore harder to disbelieve.

## A.3 · Screen-by-screen

| Screen | Change |
|---|---|
| `/` (`RoleSelect`) | **Deleted** (A-3). `/` becomes the login screen. The role hint survives as three quiet links *below* the form, which set `?role=` for the header only — the JWT remains authoritative. Removes a mandatory tap from every sign-in on the slowest connections in the product's market. |
| `/login` | Field-level validation; the "choose a different role" footer link becomes the role hint row; offline and locked states retained verbatim (they are correct). |
| `/forgot-password` | A-2. The phone-identity branch stops being a dead end: it names the institution's own contact number and states that the school office can reset the password. |
| `/reset-password`, `/change-password` | Field-level validation — three password fields each, and today an error names none of them. `/change-password` additionally stops re-authenticating by minting a session (A-5). |
| `/first-login-setup` | Already fixed in `9b0c312`; inherits the new chrome. |
| `/2fa`, `/otp` | Inherit the new chrome. No behavioural change. |

## A.4 · Responsiveness and accessibility acceptance

- 320px minimum width, no horizontal scroll, at 200% zoom.
- Every input reachable and submittable by keyboard alone; visible focus ring at 3:1.
- Every error programmatically associated with its control.
- `prefers-reduced-motion: reduce` removes all remaining motion.
- Bangla and English at parity — the `font-size-adjust: 0.51` fix stays.

---

# Part B — Admin Dashboard: requirements analysis

`OverviewScreen.tsx` (696 lines) + `logic/api.ts` (293). This screen has already had
an honesty pass: nothing on it is fabricated, every tile links to its list, the
period selector is URL-backed, and panels are permission-filtered. **The problem is
no longer truthfulness. It is that the screen answers questions nobody asked.**

## B.1 · The frame the current screen is missing

A dashboard is not a summary of the database. It is the answer to *"what do I do in
the next hour?"* The administrator of a Bangladeshi school of ~270 students runs on
a rhythm, and each beat of it has a decision attached:

| Beat | The administrator's actual question | Decision it drives |
|---|---|---|
| **Daily, 08:00–10:00** | Who is absent today? Which sections have not submitted attendance? | Phone the guardians; chase the class teacher. |
| **Daily** | Which guardians must be SMS'd — absence, dues, notice? | Send today's SMS run. |
| **Weekly** | Which students are becoming chronically absent? | Intervene before it is a dropout. |
| **Monthly** | How much of this month's billing have we actually collected? Who is behind? | Set the collection push; decide on waivers. |
| **Per term** | Are marks in? Are results processed? Are they published? | Unblock whoever is holding the term up. |
| **Per term** | Which class, which subject, which student is failing? | Remedial classes; parent meetings. |
| **Annually** | Promotion, migration, new session setup. | Run migration; open admissions. |
| **On demand** | Produce the return the managing committee or the education office asked for. | Print it. |

Set the current dashboard against that table and the finding is stark: **of eight
recurring decisions, the dashboard usefully serves one** (the monthly collection
figure). It reports enrolment counts that change a handful of times a year at the
same visual weight as figures that change hourly.

**D-0 — the governing finding.** The dashboard is organised by *entity*
(students, teachers, fees) when the job is organised by *time* (today, this week,
this term). Every finding below is a consequence.

## B.2 · Missing KPIs

Rated: **P0** blocks a daily decision · **P1** blocks a recurring one · **P2** depth.

| # | KPI | Why it matters | Feasibility |
|---|---|---|---|
| D-1 | **Present / absent today**, as a count and a rate | The single most-asked question in the building, and the dashboard cannot answer it. `fetchDashboard` aggregates 30 days; `fetchPeriodStats` aggregates a range; neither surfaces today. — **P0** | **exists** — `v_attendance_daily_summary` |
| D-2 | **Sections that have not taken attendance today** — `N of 9` | The actionable form of D-1. A 9-item checklist an operator clears before 10 a.m. Currently invisible, so a section silently missing a day is discovered at term end. — **P0** | **exists** — `class_section` LEFT JOIN the daily summary |
| D-3 | **Collection rate against what was billed this month**, not against outstanding-ever | `collectRate` today is `collected / (collected + totalDue)`, and `totalDue` is *all* unpaid invoices regardless of period. A school with two years of arrears reads a permanently depressed rate that no month's effort moves. This is a **definitional defect**, not a missing tile. — **P1** | **derivable** — `fee_invoice` in period |
| D-4 | **Aged receivables** — 0-30 / 31-60 / 61-90 / 90+ | "৳X overdue" is one number for two entirely different situations: last week's slow payers, and a year-old write-off. The action differs completely. — **P1** | **derivable** — `fee_invoice.due_date` |
| D-5 | **Chronic absentees** — students below 75% this term | The dropout predictor, and the same 75% that gates exam eligibility. Today the dashboard alerts only on the *institution* average falling below 75% — which, with 268 students, will essentially never fire while individual children disappear. — **P1** | **exists** — `v_attendance_student_summary` |
| D-6 | **Term progress** — marks entered / processed / published, per exam | The term-end bottleneck. `results_pending` counts locked-but-unpublished exams only; it says nothing about the earlier, longer stages. — **P1** | **exists** — `fn_result_status` |
| D-7 | **SMS balance and today's send count** | The product bills SMS. Running out mid-run is a silent operational failure. — **P1** | **exists** — `fn_sms_campaign_totals`, `sms_balance` |
| D-8 | **Enrolment movement** — admitted / transferred / dropped this term | `activeStudents` is a stock. Nothing shows the flow, which is what a managing committee asks about. — **P2** | **derivable** — `student.status` + `enrolled_at` |
| D-9 | **Data completeness** — % of students with guardian mobile, DOB, photo | Every SMS the school sends depends on the first. 268 records currently carry generated DOBs. — **P2** | **derivable** |

## B.3 · Missing widgets and workflows

**D-10 — "Today" as a first-class band (P0).** The screen needs a band above
everything else, scoped to *today*, containing: attendance taken (`N/9` sections),
present/absent, fees collected today, SMS sent today. This is the band the
administrator looks at and then closes the laptop. Nothing else on the screen is
time-critical.

**D-11 — the attention engine is hardcoded to three rules (P1).** `api.ts:131-172`
builds `attention` from exactly three conditions in imperative code. Adding a fourth
is a code change and a deploy. The rules missing, all material for this school today:

| Rule | Trigger | Why it is real here |
|---|---|---|
| Attendance not taken | any section, today, after a cutoff hour | 9 sections, 3 teachers |
| Sections with no class teacher | `class_section.class_teacher_id IS NULL` | mostly null at 3 teachers / 9 sections |
| Students with no guardian contact | blank guardian mobile | blocks every SMS |
| Chronic absentees | student < 75% this term | D-5 |
| Marks overdue | exam past its end date, marks incomplete | term-end bottleneck |
| SMS balance low | below a threshold | billed resource |
| Unpublished results past a date | already partly covered | |
| Incomplete student records | missing DOB / guardian / photo | 268 affected |

The fix is structural: a **declarative rule table** — each rule a `{key, severity,
evaluate, href, cta, permission}` record — so that adding a rule is adding a row and
the ordering, permission filtering and rendering are shared. Severity must sort:
today's blockers above this term's, above this year's.

**D-12 — no drill-down (P1).** Every figure is institution-wide. With 9 sections a
head teacher cannot see *which* class is dragging attendance down without leaving the
screen. The attendance panel should segment by class-section; the fee panel by class.

**D-13 — quick actions are static (P2).** Five fixed links (`OverviewScreen.tsx:178-184`).
They are correct and permission-filtered, but they never reflect state. "Take
attendance" should carry the `3 sections pending` badge; "Send SMS" should be absent
when the balance is zero.

**D-14 — no "as of" and no definitions (P2).** `staleTime: 60_000` plus a 30s router
cache means a money figure can be 90 seconds old with nothing saying so. Separately,
`collectRate` and `avgRate` are both computed figures whose definition is not
discoverable from the screen — see D-3 for what that costs.

**D-15 — the chart is 7 bars regardless of period (P2).** `trend.slice(-7)`
(`OverviewScreen.tsx:170`) is correct for "last 30 days" and actively misleading for
"this year", where it presents seven arbitrary consecutive days as the year's shape.

**D-16 — the period selector's scope is ambiguous (P2).** Documented as deliberate,
and the reasoning is right. But the selector sits under a heading placed *above* the
two panels it governs and *below* the three KPI tiles it does not — while the one
tile it *does* govern sits in the group it does not. Correct behaviour, wrong layout.

## B.4 · Target information architecture

```
┌─ TODAY ─────────────────────────────────────────────────────┐  ← new, D-10
│ Attendance 6/9 sections · 231 present, 24 absent            │
│ ৳12,400 collected · 84 SMS sent                             │
└─────────────────────────────────────────────────────────────┘
┌─ NEEDS ATTENTION ───────────────────────────────────────────┐  ← D-11
│ severity-sorted, declarative rules, each with one CTA        │
└─────────────────────────────────────────────────────────────┘
┌─ THIS MONTH / period ───────────────────────────────────────┐
│ collected vs billed (D-3) · aged receivables (D-4)          │
│ attendance trend, segmented by class (D-12)                  │
└─────────────────────────────────────────────────────────────┘
┌─ THIS TERM ─────────────────────────────────────────────────┐  ← D-6
│ exam pipeline: marks → processed → published                │
└─────────────────────────────────────────────────────────────┘
┌─ STANDING ──────────────────────────────────────────────────┐
│ enrolment · staff · sections   (point-in-time, unfiltered)   │
└─────────────────────────────────────────────────────────────┘
  activity · notices · quick actions
```

The reordering is the substance of the finding: **time-critical at the top, stock
figures at the bottom.** Today's dashboard has the stock figures at the top.

---

# Part C — Reports: requirements analysis

## C.1 · What is there now

One screen. `/admin/student/reports-summary`, reachable from two nav entries
(`adminNav.ts:103` as a Students tab, `adminNav.ts:234` as the entire "Insights"
zone). It answers exactly one question — *what is the demographic shape of our
enrolment?* — and answers it well: class, gender, religion, age, a class×religion
cross-tab, correct data-quality handling, a complete long-format export.

It is a good screen. It is not a reports module.

## C.2 · What a school actually reports on

| Domain | Consumer | Cadence | Data | Surface today |
|---|---|---|---|---|
| Academic results | head teacher, guardians, committee | per term | `exam_result`, `mark`, `grade_scale`, `fn_exam_tabulation`, `v_effective_subject_marks` | **none** |
| Attendance | class teachers, guardians, education office | daily / monthly | `v_attendance_daily_summary`, `v_attendance_student_summary`, `fn_attendance_summary` | under Attendance |
| Finance | accountant, committee | monthly / annual | `fn_fee_income_statement`, `fn_fee_day_book`, `fn_unpaid_by_institute`, `ledger_entry` | under Fees |
| Enrolment | committee, education office | per term | `fn_student_report_summary`, `v_student_demographics` | **this screen** |
| Staff | head teacher | annual | `teacher`, `teacher_assignment`, `designation` | **none** |
| Communications | admin | monthly | `v_sms_campaign_summary`, `fn_sms_campaign_totals` | under Communication |
| Compliance | auditor | on demand | `audit_log`, `access_log`, `export_log` | audit log under Settings |

**R-1 — the single largest gap in the product: there is no academic performance
report. (P0)** A school information system that cannot produce a grade distribution,
a pass rate, a subject-difficulty comparison or a class ranking is not yet doing the
job it was bought for. `fn_exam_tabulation` and `grade_scale` have been sitting there
since Phase 2.

**R-2 — Reports is a nav zone pointing at another module's tab (P1).** "Insights" as
a zone with one item, whose route is owned by Students. Either it is a module with a
hub, or it should not be a zone.

## C.3 · Raw data versus insight

This is the user's explicit ask and it deserves a definition rather than a gesture.
A **statistic** states what is. An **insight** states what is *unexpected* and what
to do about it. The test: *could a reader act differently because of this line?*

| Raw (today) | Insight (target) |
|---|---|
| "Class Six: 41 students" | "Class Six is 41 students across 1 section — 12 above the 29-student average, the only unsplit class." |
| "Average attendance 87%" | "87%, down 4 points from last term. Class Eight, Section B accounts for most of the fall." |
| "Grade distribution: A+ 12, A 30, …" | "31% scored below the pass mark in Mathematics against 9% across all other subjects — Mathematics is the outlier this term." |
| "৳84,000 outstanding" | "৳84,000 outstanding, 61% of it from 14 students, ৳31,000 of it more than 90 days old." |

**R-3 — every report must carry an interpretation layer (P0 for the module's
premise).** Concretely, each report renders a short list of *findings* computed from
its own data — outliers, deltas against the comparable prior period, concentrations —
above the tables. Not prose generated by a model; deterministic, explainable rules
whose thresholds are stated on screen.

**R-4 — the highest-value derived report is the at-risk register (P1).** Bangladeshi
secondary schools lose students to dropout, and the three signals that precede it are
already in this database: **attendance below 75%**, **marks falling term-on-term**, and
**fees unpaid past 90 days**. No single module can see all three; a report that joins
them produces a ranked list of children to intervene on. This is the report that makes
the module worth opening, and it is derivable today with no schema change.

## C.4 · The cross-cutting contract

Every report owes the same six things. Today the one existing report owes six and
delivers two.

| # | Requirement | Status |
|---|---|---|
| R-5 | **Filters** — class, section, shift, gender, status, date range, academic year, URL-backed | **absent.** `useStudentReport()` is called with no arguments (`ReportsSummaryScreen.tsx:38`); it returns the whole institution, always. A user cannot ask "girls in Class Five". The Teacher Directory already implements filter → URL → paginate → export; Reports implements none of it. **P0** |
| R-6 | **Export** — complete, long-format, BOM'd | **done**, fixed in `9b0c312`. The pattern generalises. |
| R-7 | **Export logging** — who exported what, when | **absent.** `export_log` exists, is typed, has RLS, and has zero rows because no code writes to it (`grep -rn "export_log" src` → `database.types.ts` only). 19 screens call `exportCsv`, including full rosters with guardian mobile numbers. For a system holding 268 minors' records this is the gap most likely to matter to a regulator. **P1** |
| R-8 | **Print** — the actual deliverable | **absent.** `globals.css` ships a considered print stylesheet (`@page { margin: 12mm }`, `data-print="sheet"`); exactly one screen in the product uses it (Day Book). Bangladeshi schools submit printed returns. **P1** |
| R-9 | **Provenance** — as-of time, filters applied, definitions | **absent** everywhere. A printed report that does not state its own filters is unciteable. **P1** |
| R-10 | **Scheduling** — weekly digest, month-end statement | **absent**, `pg_cron` is Phase 4 W12. **P2**, correctly deferred. |

## C.5 · Target information architecture

```
/admin/reports                    hub: catalogue + what each answers + last run
  /admin/reports/enrolment        ← today's screen, given filters
  /admin/reports/academic         ← R-1. grade distribution, pass rate,
                                     subject difficulty, class ranking
  /admin/reports/attendance       ← institution view over the existing views
  /admin/reports/finance          ← collection efficiency + ageing
  /admin/reports/at-risk          ← R-4. the cross-domain register
```

Module-local reports (Day Book, Unpaid by Section, Attendance Register) **stay where
they are**. They are operational tools used inside a workflow, not analysis. Reports
is where cross-cutting, decision-support and printable output lives. The rail's
"Insights" zone points at the hub.

---

# Part D — Delivery plan

Sequenced so that each step is independently shippable and each removes a stated
falsehood or an unanswerable question.

**Status: all twelve items shipped.**

| # | Work | From | Size | Shipped |
|---|---|---|---|---|
| 1 | Auth redesign — chrome, rail, card, typography | A.1 | M | `4f5fc7b` |
| 2 | Auth correctness — role interstitial removed, field-level errors, reauth, recovery dead end | A-3/4/5/2 | M | `4f5fc7b`, `bdbb68e` |
| 3 | Dashboard "Today" band + attendance-not-taken | D-1, D-2, D-10 | M | `b2b5f0e` |
| 4 | Declarative attention rules | D-11 | M | `b2b5f0e` |
| 5 | Collection rate against billing + ageing | D-3, D-4 | M | `b2b5f0e` (D-4), `4c483dc` (D-3) |
| 6 | Reports hub + filters on enrolment | R-2, R-5 | M | `246a303` |
| 7 | Academic performance report | R-1 | L | `246a303` |
| 8 | Insight layer | R-3 | M | `246a303` |
| 9 | At-risk register | R-4 | L | `246a303` |
| 10 | Export logging | R-7 | S | `7de278c`, `4c483dc` |
| 11 | Print output + provenance | R-8, R-9 | M | `246a303` |
| 12 | Drill-down, term pipeline, as-of | D-12, D-6, D-14 | M | `837fc88`, `b2b5f0e` |

**Explicitly out of scope and why:** SMS-based password recovery (needs a contracted
provider — Phase 4 W13); scheduled reports (needs `pg_cron` — Phase 4 W12); the
teacher application (A-8, an architectural gap larger than these three surfaces).

## D.1 · What the build found that the analysis did not

Three defects surfaced only when the work was run against the live database.
All three share a shape worth naming, because it is the shape this whole
document was written to hunt: **a figure that looks like a finding about
children but is actually a fact about the data.**

**The at-risk register's first run named 22 children as dropout risks.** All at
"0% attendance". The school has taken the register once — 272 of 280
student-section rows hold `total_days = 1` — so every child absent on that one
day was listed, with their guardian's phone number, on a page a head teacher is
meant to act on. One absence is an incident; a pattern needs enough
observations to be a pattern. Signals now require 20 recorded days.

The more important half of that fix is the second one: **a signal that cannot be
computed now says so.** "No child is at attendance risk" and "we have not taken
enough registers to know" render identically as a shorter list, and only one of
them is good news. The same applies to the marks signal, which needs two
processed exams and currently has one. The clean-bill-of-health finding is
suppressed whenever any signal is dark — otherwise the most reassuring sentence
on the page is the one with the least evidence behind it.

**`fn_process_exam_result` never wrote `exam_result.grade`.** Found because R-1's
headline panel is a grade distribution and every band rendered zero. Not a
grading gap — `grade_scale` is seeded, `gpa` is computed from it, `result` is
derived from it — the `INSERT` simply never listed the column. Four readers have
rendered an em-dash since Phase 2, including `MarksheetDoc`: **every marksheet
this product has handed to a guardian says "Grade: —".** Fixed and backfilled.
This is the `export_log` pattern again — a column with types, constraints and no
writer — and it suggests a standing check is worth having: *which columns does
the schema define that no code path populates?*

**`exportCsv`'s audit argument was required but only 6 of 19 call sites passed
it**, so `tsc` failed on `main` from `7de278c` until `4c483dc`. The type system
caught it; nothing ran the type system on the way in. Worth a CI gate.

## D.2 · What is now next

Not scoped here, but named because the build made them visible:

1. **Attendance is not being taken.** Every finding above traces back to it. The
   product's own D-2 rule exists to chase this daily and the school is not yet
   on it — which is an onboarding problem, not a software one, but the software
   is now the thing that can see it.
2. **`/admin/reports/attendance` and `/admin/reports/finance`** are in §C.5's
   target IA and are not built; the hub links to the existing module screens and
   labels them as living there. Honest, but not the same thing.
3. **The academic report's populated path is untested against real data** — there
   are no processed results in the live database. Its empty and workflow states
   are verified; its grade distribution, ranking and subject table are verified
   only by construction and by the GPA→letter mapping checked across the scale.
