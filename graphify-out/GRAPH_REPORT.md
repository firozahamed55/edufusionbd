# Graph Report - edufusionbd-web  (2026-07-25)

## Corpus Check
- 309 files · ~133,862 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1371 nodes · 2750 edges · 94 communities (82 shown, 12 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8b218564`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]

## God Nodes (most connected - your core abstractions)
1. `useT()` - 135 edges
2. `cn()` - 105 edges
3. `useErrorMessage()` - 77 edges
4. `useToast()` - 31 edges
5. `createClient()` - 28 edges
6. `useMut()` - 26 edges
7. `useClassSectionsLookup()` - 23 edges
8. `rpc()` - 22 edges
9. `rpc()` - 21 edges
10. `BrowserClient` - 17 edges

## Surprising Connections (you probably didn't know these)
- `cn()` --calls--> `clsx`  [INFERRED]
  src/shared/lib/cn.ts → package.json
- `StyleguidePage()` --calls--> `useToast()`  [INFERRED]
  src/app/(admin)/admin/styleguide/page.tsx → src/shared/ui/Toast.tsx
- `AdminError()` --calls--> `useT()`  [EXTRACTED]
  src/app/(admin)/admin/error.tsx → src/shared/i18n/useT.ts
- `ParentError()` --calls--> `useT()`  [EXTRACTED]
  src/app/(parent)/parent/error.tsx → src/shared/i18n/useT.ts
- `AttendanceMarker()` --calls--> `useToast()`  [INFERRED]
  src/features/admin/attendance/components/AttendanceMarker.tsx → src/shared/ui/Toast.tsx

## Communities (94 total, 12 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (51): Home(), Day, MONTH, ParentAttendance(), ChangePasswordPage(), AuthCard(), AuthShell(), ChildSwitcher() (+43 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (19): 1. Is it up?, 2. Finding an error a user reported, 3. Common failures, 4. Database, 5. Owner-only actions (not reachable from code), 6. Deploys, A user is told their password is wrong, but it isn't, A write fails with "You don't have permission to do this" (+11 more)

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (9): AnalyticsScreen(), iso(), SoftStat(), softTone, useAttendanceSummary(), iso(), ReportScreen(), SoftStat() (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (19): ClassScreen(), EMPTY, EMPTY_CLASS, EMPTY_SECTION, useClasses(), useClassSections(), useDeleteClass(), useDeleteClassSection() (+11 more)

### Community 4 - "Community 4"
Cohesion: 0.20
Nodes (10): CommentConfigScreen(), Bilingual, ConfigField, ConfigTab(), ExamToggle(), SettingsShell(), SettingsTabId, TABS (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (10): EMPTY, FeeMappingScreen(), FREQUENCIES, SoftStat(), softTone, useDeleteFeeMapping(), useFeeHeads(), useFeeMappings() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (15): fetchMigrationBatches(), fetchMigrationBatchStudents(), fetchStudentBasic(), fetchTeacherDetail(), MigrationBatchRow, MigrationBatchStudent, MigrationStudentInput, runMigrationSchema (+7 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (17): devDependencies, eslint, eslint-config-next, @eslint/eslintrc, eslint-plugin-boundaries, jsdom, postcss, tailwindcss (+9 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (23): call(), ClassRow, ClassSectionRow, deleteClass(), deleteClassSection(), deleteGradeScheme(), deleteSignature(), deleteSubject() (+15 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (18): AttendanceMarker(), DAILY, EXAM, iso(), StatusDef, AttTone, solidTone, StatusPill() (+10 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (22): AccountRow, AppliedFee, CollectPayload, collectPayloadSchema, deleteInvoiceIdsSchema, DigitalTxn, DigitalTxnStats, FeeHeadRow (+14 more)

### Community 11 - "Community 11"
Cohesion: 0.17
Nodes (13): BatchRow, CertRecord, deleteTemplate(), ExamOpt, fetchAdmitBatches(), fetchIdCardBatches(), fetchSetting(), fetchTemplates() (+5 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (11): AttendanceSummary, ExamOption, ExamPayload, ExamResultRow, ExamRow, fetchExams(), fetchGradeSchemes(), GradeSchemeOption (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (28): cn(), Badge(), BadgeTone, tones, BarChart(), BarDatum, Donut(), Checkbox() (+20 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 15 - "Community 15"
Cohesion: 0.10
Nodes (19): AdmitCardScreen(), BatchCreator(), CertRecordForm(), IdCardScreen(), useAdmitBatches(), useCreateAdmitBatch(), useCreateIdBatch(), useCreateTestimonial() (+11 more)

### Community 16 - "Community 16"
Cohesion: 0.06
Nodes (35): BalancePurchaseScreen(), ADMIN_NAV_FOOTER, ADMIN_NAV_SECTIONS, AdminNavItem, AdminNavSection, AdminSubGroup, AdminSubItem, AdminShell() (+27 more)

### Community 17 - "Community 17"
Cohesion: 0.06
Nodes (49): DOCS, EMPTY, FormState, TeacherForm(), ATTENDANCE_STATUS, BiLabel, BLOOD_GROUP, BLOOD_LABEL (+41 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (18): CampaignRow, createAdmitBatch(), createIdCardBatch(), createTestimonial(), createTransfer(), deleteNotice(), NoticeRow, purchasePackage() (+10 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (8): useDashboard(), Alert(), Card(), Kpi(), LegendRow(), Notice(), OverviewScreen(), toneMap

### Community 20 - "Community 20"
Cohesion: 0.20
Nodes (8): AdmitInstructionScreen(), Bilingual, SettingConfig(), SettingField, ExamEssentialsScreen(), useSaveSetting(), useSetting(), useErrorMessage()

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (6): ResultProcessor(), useExamResults(), useProcessExam(), MarkProcessScreen(), ResultProcessScreen(), ResultSheetDownloadScreen()

### Community 22 - "Community 22"
Cohesion: 0.15
Nodes (13): dependencies, clsx, lucide-react, next, next-intl, next-themes, react, react-dom (+5 more)

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (11): Boundaries (enforced by ESLint `boundaries/element-types`), code:block1 (src/), code:bash (npm install), EduFusionBD — Web Frontend, Figma collection, Getting started, Light + dark, Scripts (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.05
Nodes (46): ACTION_TONE, AuditLogScreen(), ENTITY_LABEL, Page(), { result }, { result, rerender }, useDebouncedValue(), ListScreen() (+38 more)

### Community 25 - "Community 25"
Cohesion: 0.04
Nodes (48): 0. Executive Summary, 10. Still open, and honestly so, 1.1 Audit-area scores, 1.2 Production-readiness scores (each /100), 1. Scorecard, 2. What is already good — keep unchanged, 3. Findings & prioritized optimization roadmap, 3. Findings & roadmap — final state (+40 more)

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (10): Colour tokens, EduFusionBD — Design System, Elevation, Gradients, Iconography, Motion, Principles, Radius & spacing (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (10): 0. Scope & method, 1. Layout & structure, 2. Typography, 3. Component audit, 4. Interaction states, 5. Responsiveness, 6. Accessibility, 7. UX friction / cognitive load (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (10): B1 — Git commits could not be made in this environment (HIGH), B2 — Figma screen authoring was scoped to code, not the Figma file (HIGH), B3 — ESLint could not run in the sandbox (LOW), B4 — Shell mount serves stale content for overwritten files (INFO), B5 — Stray temp file on the mount (INFO), B6 — Backend flows are UI-complete, not yet server-wired (MEDIUM), code:block1 (warning: unable to unlink '…/.git/index.lock': Operation not), code:block2 (cd edufusionbd-web) (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.27
Nodes (8): PAYMENT_METHOD, amountString, isoDate, optionalText(), optionalUuid, paymentMethod, shortText(), uuid

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (12): scripts, build, db:diff, db:pull, dev, gen:types, lint, start (+4 more)

### Community 31 - "Community 31"
Cohesion: 0.22
Nodes (7): Button(), ButtonProps, Size, sizes, Variant, variants, Modal()

### Community 32 - "Community 32"
Cohesion: 0.20
Nodes (9): Actual table sizes (project `dkumhtrrgsuwxucgncix`, 2026-07-25), ADR-0002 — Table partitioning and materialized dashboard views: deferred, with triggers, code:block1 (Seq Scan on institution i  (rows=1)              actual time), Consequences, Context, Dashboard view cost — `explain (analyze, buffers) select * from v_dashboard_kpi`, Decision, Why not materialize the dashboard (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.24
Nodes (6): hindSiliguri, inter, metadata, notoSansBengali, Providers(), ThemeProvider()

### Community 34 - "Community 34"
Cohesion: 0.25
Nodes (7): extends, plugins, rules, boundaries/element-types, settings, boundaries/elements, boundaries/include

### Community 35 - "Community 35"
Cohesion: 0.25
Nodes (5): done, failed, meta, SCHEMA, SCREENS

### Community 36 - "Community 36"
Cohesion: 0.09
Nodes (19): ATTENDANCE_TYPES, BasicConfigScreen(), CURRENCIES, DATE_FORMATS, DAYS, LANGUAGES, MONTHS, NUMBER_SYSTEMS (+11 more)

### Community 37 - "Community 37"
Cohesion: 0.29
Nodes (6): Decisions made autonomously, Phase status, QA checklist results, UI/UX Overhaul — Run Log, Verification, What changed (files)

### Community 38 - "Community 38"
Cohesion: 0.43
Nodes (4): Locale, locales, cookieLocale, LocaleToggle()

### Community 39 - "Community 39"
Cohesion: 0.16
Nodes (9): metadata, ROUTES, buildCsp(), ADMIN_ROLES, config, middleware(), PUBLIC_PREFIXES, SessionClaims (+1 more)

### Community 40 - "Community 40"
Cohesion: 0.30
Nodes (7): MarksEntry(), useExams(), useExistingMarks(), useSaveMarks(), useSectionClassId(), useSubjects(), MarkInputScreen()

### Community 41 - "Community 41"
Cohesion: 0.25
Nodes (8): code:bash (# Re-sync after someone applies a change out-of-band:), EduFusionBD — Database Tier (`supabase/`), Materialize the migration `.sql` files, Migration files are IN THIS REPO (as of 2026-07-25), Migration history (22 migrations), Migration history (34 migrations), RPC catalog (server-side business logic), Three-tier separation

### Community 42 - "Community 42"
Cohesion: 0.33
Nodes (5): Auth module — `@/features/auth/components`, Conventions, EduFusionBD — Component Library, Parent module — `@/features/parent`, Shared primitives — `@/shared/ui`

### Community 43 - "Community 43"
Cohesion: 0.20
Nodes (5): a, b, csp, getClaims, location

### Community 44 - "Community 44"
Cohesion: 0.40
Nodes (4): csp, nextConfig, securityHeaders, withNextIntl

### Community 45 - "Community 45"
Cohesion: 0.40
Nodes (4): _comment, fileKey, page, screens

### Community 46 - "Community 46"
Cohesion: 0.25
Nodes (7): ADR-0001 — Background-job / queue infrastructure: deferred, with a trigger, Consequences, Context, Decision, The intended design (build this, when the trigger fires), Trigger — build it when ANY of these is true, Why building it now would be wrong, not merely early

### Community 47 - "Community 47"
Cohesion: 0.50
Nodes (3): Role, ROLE_LABELS, ROLES

### Community 48 - "Community 48"
Cohesion: 0.40
Nodes (3): PageBtn(), Pagination(), onPageChange

### Community 49 - "Community 49"
Cohesion: 0.25
Nodes (7): ADR-0003 — Observability: native `onRequestError` + structured logs, not a vendor APM (yet), Context, Decision, PII is the hard constraint, and it is enforced in code, Trigger for revisiting, What this does NOT provide, Wiring a vendor later

### Community 50 - "Community 50"
Cohesion: 0.32
Nodes (11): fetchAcademicYears(), fetchClasses(), fetchClassSections(), fetchDepartments(), fetchDesignations(), fetchDistricts(), fetchDivisions(), fetchStudentCategories() (+3 more)

### Community 51 - "Community 51"
Cohesion: 0.24
Nodes (7): EMPTY, ExamSettingsTab(), STATUSES, TYPES, useGradeSchemes(), useUpsertExam(), SettingsScreen()

### Community 52 - "Community 52"
Cohesion: 0.08
Nodes (29): AdminError(), Bilingual, ParentError(), classifyError(), COPY, describeError(), ErrorKind, readCode() (+21 more)

### Community 56 - "Community 56"
Cohesion: 0.25
Nodes (7): name, //overrides, postcss, sharp, private, type, version

### Community 57 - "Community 57"
Cohesion: 0.21
Nodes (7): HistoryScreen(), typeLabel, exportCsv(), useCampaigns(), useUsers(), statusTone, UserListScreen()

### Community 58 - "Community 58"
Cohesion: 0.38
Nodes (3): Option, QuickCollectionListScreen(), useSectionStudents()

### Community 63 - "Community 63"
Cohesion: 0.30
Nodes (8): EMPTY, InstitutionForm(), useEducationBoards(), useInstitution(), useUpdateInstitution(), INSTITUTION_TYPES, MPO_STATUSES, StartupScreen()

### Community 65 - "Community 65"
Cohesion: 0.17
Nodes (10): MigrationRunner(), RunMigrationPayload, useMigrationBatches(), useMigrationBatchStudents(), usePushbackMigration(), useRunMigration(), useSectionStudents(), MigrationMeritScreen() (+2 more)

### Community 66 - "Community 66"
Cohesion: 0.26
Nodes (8): getAssetSignedUrl(), RpcFn, uploadInstitutionAsset(), useDeleteSignature(), useSignatures(), useUpsertSignature(), ROLES, SignatureScreen()

### Community 67 - "Community 67"
Cohesion: 0.17
Nodes (11): code:tsx (const [selected, setSelected] = useState<Set<string>>(new Se), code:tsx (<TH className="w-10">), code:tsx (<TD>), code:bash (git commit -am "feat(admin): add row selection + bulk-action), code:ts (/**), code:tsx (<button), code:bash (comm -23 <(find src/features/admin -name "*.tsx" | sort) <(g), PHASE 3 — Enterprise Feature Parity (Medium) (+3 more)

### Community 68 - "Community 68"
Cohesion: 0.31
Nodes (7): useAccounts(), useCollectFee(), useStudentInvoices(), useStudentProfile(), ProfileRow(), QuickCollectionFormScreen(), SummaryTile()

### Community 69 - "Community 69"
Cohesion: 0.19
Nodes (20): rpc(), collectFee(), deleteFeeInvoices(), deleteFeeMapping(), fetchAttendanceSummary(), fetchIncomeStatement(), fetchStudentReport(), fetchUnpaidByInstitute() (+12 more)

### Community 70 - "Community 70"
Cohesion: 0.18
Nodes (11): code:ts (import { useSmsAccount } from "@/features/admin/sms-notice/l), code:ts (const { data: smsAccount } = useSmsAccount();), code:tsx (<div className="hidden items-center gap-1.5 rounded-full bg-), code:tsx (-          <button), code:tsx (-        <button className="flex items-center gap-2 rounded-), code:ts (export type TeacherRow = {), code:tsx (const [dept, setDept] = useState("");), code:tsx (-        <button className="flex items-center gap-1.5 rounde) (+3 more)

### Community 71 - "Community 71"
Cohesion: 0.29
Nodes (4): DEFAULT_SCALES, GradingScreen(), REMARKS, GradeScale

### Community 73 - "Community 73"
Cohesion: 0.20
Nodes (9): code:tsx ("use client";), code:ts (auditLog: {), code:ts (// Supabase data access for the Audit Log screen. RLS-scoped), code:ts ("use client";), code:tsx ("use client";), code:tsx (import { AuditLogScreen } from "@/features/admin/core/screen), code:ts ({), code:bash (npx tsc --noEmit) (+1 more)

### Community 74 - "Community 74"
Cohesion: 0.31
Nodes (4): IncomeStatementScreen(), iso(), LedgerRow(), useIncomeStatement()

### Community 75 - "Community 75"
Cohesion: 0.48
Nodes (4): useDeleteGroup(), useSubjectGroups(), useUpsertGroup(), SubjectGroupScreen()

### Community 76 - "Community 76"
Cohesion: 0.22
Nodes (8): code:ts ("use client";), code:ts (const PAGE_SIZE_DEFAULT = 20;), code:ts (list: (filters?: Filters) => ["teachers", "list", filters ??), code:ts ("use client";), code:tsx (const [q, setQ] = useState("");), code:bash (npx tsc --noEmit), code:bash (git add src/features/admin/teacher/screens/list src/shared/l), Task 3: Server-scoped pagination + debounced search on the Teacher list

### Community 77 - "Community 77"
Cohesion: 0.36
Nodes (5): DigitalCollectionScreen(), gatewayMeta, statusMeta, useDigitalTransactions(), useDigitalTransactionStats()

### Community 79 - "Community 79"
Cohesion: 0.25
Nodes (8): code:tsx (import Link from "next/link";), code:ts (export { Breadcrumb, type Crumb } from "./Breadcrumb";), code:tsx (-        <div className="flex items-center gap-1.5 text-[13p), code:bash (npx tsc --noEmit), code:bash (git commit -am "feat(design-system): add shared Breadcrumb c), PHASE 2 — Design System Completion (High), Task 6: Ship a shared Breadcrumb component and roll it out, Task 7: Extend server-side pagination to the other unbounded lists

### Community 80 - "Community 80"
Cohesion: 0.25
Nodes (8): code:tsx ("use client";), code:ts (import { CommandPalette } from "./CommandPalette";), code:ts (const [paletteOpen, setPaletteOpen] = useState(false);), code:tsx (<button), code:tsx (<CommandPalette open={paletteOpen} onClose={() => setPalette), code:bash (npx tsc --noEmit), code:bash (git commit -am "feat(admin): add Ctrl+K command palette, res), Task 10: Command palette (Ctrl+K)

### Community 82 - "Community 82"
Cohesion: 0.29
Nodes (6): code:block1 (src/shared/ui/), EduFusionBD Admin Panel — 100/100 Institutional-Grade Implementation Plan, File structure overview, Global Constraints, PHASE 1 — Trust & Scale Floor (Critical), Task 4: Confirm the audit trail actually shows up end-to-end

### Community 84 - "Community 84"
Cohesion: 0.29
Nodes (7): code:css (/* Type scale — named tokens matching the sizes already in p), code:bash (npx next build), code:powershell ($map = @{), code:bash (npx tsc --noEmit), code:bash (grep -rn "text-\[1[1235]px\]\|text-\[17px\]\|text-\[22px\]\|), code:bash (git add src/app/globals.css src), Task 5: Publish a named type scale and migrate to it

### Community 85 - "Community 85"
Cohesion: 0.29
Nodes (5): SIZES, StyleguidePage(), TONES, TYPE_SCALE, VARIANTS

### Community 86 - "Community 86"
Cohesion: 0.53
Nodes (3): DeleteFeesScreen(), useAppliedFees(), useDeleteFeeInvoices()

### Community 89 - "Community 89"
Cohesion: 0.33
Nodes (6): PHASE 4 — Verification & Polish (Low), Spec coverage, Task 12: Decide on automated test coverage (explicit decision point), Task 13: CSP nonce, Task 14: Living style-guide page, Task 15: Hover/pressed-state audit

### Community 93 - "Community 93"
Cohesion: 0.60
Nodes (3): Breadcrumb(), Crumb, PageHeader()

## Knowledge Gaps
- **457 isolated node(s):** `compat`, `config`, `withNextIntl`, `securityHeaders`, `nextConfig` (+452 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `Community 0` to `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 9`, `Community 15`, `Community 16`, `Community 17`, `Community 19`, `Community 20`, `Community 21`, `Community 24`, `Community 36`, `Community 40`, `Community 48`, `Community 51`, `Community 52`, `Community 57`, `Community 58`, `Community 59`, `Community 60`, `Community 63`, `Community 65`, `Community 66`, `Community 68`, `Community 71`, `Community 74`, `Community 75`, `Community 77`, `Community 86`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `cn()` connect `Community 13` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 9`, `Community 15`, `Community 16`, `Community 17`, `Community 19`, `Community 21`, `Community 22`, `Community 24`, `Community 31`, `Community 36`, `Community 38`, `Community 40`, `Community 48`, `Community 51`, `Community 57`, `Community 58`, `Community 59`, `Community 60`, `Community 65`, `Community 66`, `Community 68`, `Community 71`, `Community 74`, `Community 75`, `Community 77`, `Community 86`, `Community 90`, `Community 93`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `clsx` connect `Community 22` to `Community 13`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Are the 30 inferred relationships involving `useToast()` (e.g. with `StyleguidePage()` and `AttendanceMarker()`) actually correct?**
  _`useToast()` has 30 INFERRED edges - model-reasoned connections that need verification._
- **What connects `compat`, `config`, `withNextIntl` to the rest of the system?**
  _457 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05209397344228805 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._