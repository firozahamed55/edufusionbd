# Graph Report - edufusionbd-web  (2026-07-18)

## Corpus Check
- 231 files · ~76,828 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 994 nodes · 2041 edges · 66 communities (57 shown, 9 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 55 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cd267989`
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

## God Nodes (most connected - your core abstractions)
1. `useT()` - 116 edges
2. `cn()` - 100 edges
3. `useToast()` - 28 edges
4. `createClient()` - 25 edges
5. `useMut()` - 24 edges
6. `useClassSectionsLookup()` - 23 edges
7. `rpc()` - 21 edges
8. `compilerOptions` - 16 edges
9. `useActiveChild()` - 15 edges
10. `TeacherForm()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `cn()` --calls--> `clsx`  [INFERRED]
  src/shared/lib/cn.ts → package.json
- `markAttendance()` --calls--> `rpc()`  [INFERRED]
  src/features/admin/attendance/logic/api.ts → src/features/admin/core/logic/api.ts
- `fetchAttendanceSummary()` --calls--> `rpc()`  [INFERRED]
  src/features/admin/attendance/logic/api.ts → src/features/admin/core/logic/api.ts
- `ParentNotices()` --calls--> `useT()`  [EXTRACTED]
  src/app/(parent)/parent/notices/page.tsx → src/shared/i18n/useT.ts
- `AttendanceMarker()` --calls--> `useToast()`  [INFERRED]
  src/features/admin/attendance/components/AttendanceMarker.tsx → src/shared/ui/Toast.tsx

## Communities (66 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (17): ChildSwitcher(), PARENT_NAV, ParentNavItem, greetingKey(), ParentShellInner(), Child, CHILDREN, getGuardianName() (+9 more)

### Community 1 - "Community 1"
Cohesion: 0.18
Nodes (17): DOCS, EMPTY, FormState, TeacherForm(), BLOOD_LABEL, fetchTeacherOptions(), registerTeacher(), TeacherFormValues (+9 more)

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (11): AnalyticsScreen(), iso(), SoftStat(), softTone, useAttendanceSummary(), Option, useClassSectionsLookup(), iso() (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (32): BasicConfigScreen(), ClassScreen(), EMPTY, EMPTY, InstitutionForm(), DEFAULT_SCALES, GradingScreen(), useClasses() (+24 more)

### Community 4 - "Community 4"
Cohesion: 0.23
Nodes (8): CommentConfigScreen(), ConfigField, ConfigTab(), ExamToggle(), SettingsShell(), TABS, useExamConfig(), useSaveExamConfig()

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (28): DeleteFeesScreen(), DigitalCollectionScreen(), gatewayMeta, statusMeta, EMPTY, FeeMappingScreen(), FREQUENCIES, SoftStat() (+20 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (25): MigrationRunner(), fetchMigrationBatches(), fetchMigrationBatchStudents(), fetchStudentBasic(), fetchStudentReport(), fetchTeacherDetail(), MigrationBatchRow, MigrationBatchStudent (+17 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (35): dependencies, clsx, lucide-react, next, next-intl, next-themes, react, react-dom (+27 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (20): call(), ClassRow, deleteClass(), deleteGradeScheme(), deleteSignature(), deleteSubject(), deleteSubjectGroup(), GradeScale (+12 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (9): AttendanceMarker(), iso(), ExamScreen(), c(), useMarkAttendance(), useSectionAttendance(), SectionScreen(), UpdateExamScreen() (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (13): AccountRow, AppliedFee, CollectPayload, DigitalTxn, FeeHeadRow, FeeMappingPayload, FeeMappingRow, findStudentIdByCode() (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (18): BatchRow, CertRecord, createAdmitBatch(), createIdCardBatch(), createTestimonial(), createTransfer(), deleteTemplate(), ExamOpt (+10 more)

### Community 12 - "Community 12"
Cohesion: 0.10
Nodes (17): collectFee(), deleteFeeInvoices(), deleteFeeMapping(), ExamPayload, ExamResultRow, ExamRow, fetchGradeSchemes(), fetchIncomeStatement() (+9 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (17): cn(), Checkbox(), Field(), FormCard(), Input(), Option, Select(), Textarea() (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (25): AdmitCardScreen(), AdmitInstructionScreen(), BatchCreator(), CertRecordForm(), SettingConfig(), SettingField, ExamEssentialsScreen(), IdCardScreen() (+17 more)

### Community 16 - "Community 16"
Cohesion: 0.08
Nodes (22): BalancePurchaseScreen(), TemplateManager(), TYPES, useDeleteNotice(), useDeleteTemplate(), useNotices(), usePackages(), usePurchasePackage() (+14 more)

### Community 17 - "Community 17"
Cohesion: 0.15
Nodes (14): ATTENDANCE_STATUS, BiLabel, BLOOD_GROUP, BLOOD_TOKEN, EMPLOYMENT_TYPE, FEE_STATUS, GENDER, LANGUAGE (+6 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (13): CampaignRow, deleteNotice(), fetchSmsAccount(), fetchTemplates(), fetchUnpaidBySection(), NoticeRow, num(), purchasePackage() (+5 more)

### Community 19 - "Community 19"
Cohesion: 0.16
Nodes (8): useDashboard(), Alert(), Card(), Kpi(), LegendRow(), Notice(), OverviewScreen(), toneMap

### Community 20 - "Community 20"
Cohesion: 0.23
Nodes (11): RegisterPayload, registerStudent(), useRegisterStudent(), useAcademicYears(), useDistricts(), useDivisions(), useStudentCategories(), useUpazilas() (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (6): ResultProcessor(), useExamResults(), useProcessExam(), MarkProcessScreen(), ResultProcessScreen(), ResultSheetDownloadScreen()

### Community 22 - "Community 22"
Cohesion: 0.15
Nodes (8): HISTORY, Line, LINES, ParentFees(), Payment, ParentNotices(), NOTICES, ParentHome()

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (11): Boundaries (enforced by ESLint `boundaries/element-types`), code:block1 (src/), code:bash (npm install), EduFusionBD — Web Frontend, Figma collection, Getting started, Light + dark, Scripts (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.06
Nodes (33): ADMIN_NAV_FOOTER, ADMIN_NAV_SECTIONS, AdminNavItem, AdminNavSection, AdminSubGroup, AdminSubItem, AdminShell(), BrowserClient (+25 more)

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
Cohesion: 0.18
Nodes (8): STUDENT_STATUS, useStudentReport(), AGE_LABELS, AGE_ORDER, Card(), LegendRow(), ReportsSummaryScreen(), StatRow()

### Community 30 - "Community 30"
Cohesion: 0.16
Nodes (13): ChangePasswordPage(), isRole(), safeInternalPath(), FirstLoginSetupPage(), ForgotPasswordPage(), useT(), isPhoneIdentity(), resolveLoginEmail() (+5 more)

### Community 31 - "Community 31"
Cohesion: 0.22
Nodes (7): Button(), ButtonProps, Size, sizes, Variant, variants, Modal()

### Community 32 - "Community 32"
Cohesion: 0.18
Nodes (9): AttendanceSummary, ExamOption, fetchAttendanceSummary(), fetchExams(), markAttendance(), MarkAttendancePayload, RpcFn, TeacherRow (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.28
Nodes (5): hindSiliguri, inter, metadata, Providers(), ThemeProvider()

### Community 34 - "Community 34"
Cohesion: 0.25
Nodes (7): extends, plugins, rules, boundaries/element-types, settings, boundaries/elements, boundaries/include

### Community 35 - "Community 35"
Cohesion: 0.25
Nodes (5): done, failed, meta, SCHEMA, SCREENS

### Community 36 - "Community 36"
Cohesion: 0.23
Nodes (9): DAILY, EXAM, StatusDef, AttTone, solidTone, StatusPill(), SummaryDot(), tintTone (+1 more)

### Community 37 - "Community 37"
Cohesion: 0.29
Nodes (6): Decisions made autonomously, Phase status, QA checklist results, UI/UX Overhaul — Run Log, Verification, What changed (files)

### Community 38 - "Community 38"
Cohesion: 0.43
Nodes (4): Locale, locales, cookieLocale, LocaleToggle()

### Community 39 - "Community 39"
Cohesion: 0.12
Nodes (16): Home(), AuthCard(), AuthShell(), HOME, Role, ROLE_LABELS, roleHome(), ROLES (+8 more)

### Community 40 - "Community 40"
Cohesion: 0.30
Nodes (7): MarksEntry(), useExams(), useExistingMarks(), useSaveMarks(), useSectionClassId(), useSubjects(), MarkUpdateScreen()

### Community 41 - "Community 41"
Cohesion: 0.29
Nodes (6): code:bash (# 1. Install the CLI (once):    npm i -g supabase   (or: npx), EduFusionBD — Database Tier (`supabase/`), Materialize the migration `.sql` files, Migration history (22 migrations), RPC catalog (server-side business logic), Three-tier separation

### Community 42 - "Community 42"
Cohesion: 0.33
Nodes (5): Auth module — `@/features/auth/components`, Conventions, EduFusionBD — Component Library, Parent module — `@/features/parent`, Shared primitives — `@/shared/ui`

### Community 43 - "Community 43"
Cohesion: 0.47
Nodes (3): HistoryScreen(), typeLabel, useCampaigns()

### Community 44 - "Community 44"
Cohesion: 0.40
Nodes (4): csp, nextConfig, securityHeaders, withNextIntl

### Community 45 - "Community 45"
Cohesion: 0.40
Nodes (4): _comment, fileKey, page, screens

### Community 46 - "Community 46"
Cohesion: 0.40
Nodes (3): BarChart(), BarDatum, Donut()

### Community 47 - "Community 47"
Cohesion: 0.50
Nodes (3): Role, ROLE_LABELS, ROLES

### Community 48 - "Community 48"
Cohesion: 0.13
Nodes (6): Card(), Badge(), BadgeTone, tones, PasswordInput(), Stepper()

### Community 49 - "Community 49"
Cohesion: 0.50
Nodes (3): StatCard(), Trend, trendMeta

### Community 50 - "Community 50"
Cohesion: 0.32
Nodes (11): fetchAcademicYears(), fetchClasses(), fetchClassSections(), fetchDepartments(), fetchDesignations(), fetchDistricts(), fetchDivisions(), fetchStudentCategories() (+3 more)

### Community 51 - "Community 51"
Cohesion: 0.27
Nodes (6): EMPTY, ExamSettingsTab(), STATUSES, TYPES, useUpsertExam(), SettingsScreen()

### Community 52 - "Community 52"
Cohesion: 0.22
Nodes (4): Bilingual, BN_DIGITS, QuickCollectionListScreen(), useSectionStudents()

### Community 56 - "Community 56"
Cohesion: 0.29
Nodes (5): meta, ToastContext, ToastInput, ToastItem, ToastVariant

### Community 57 - "Community 57"
Cohesion: 0.47
Nodes (3): useUsers(), statusTone, UserListScreen()

### Community 60 - "Community 60"
Cohesion: 0.50
Nodes (3): Day, MONTH, ParentAttendance()

## Knowledge Gaps
- **260 isolated node(s):** `extends`, `plugins`, `boundaries/include`, `boundaries/elements`, `boundaries/element-types` (+255 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `Community 30` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 9`, `Community 15`, `Community 16`, `Community 17`, `Community 19`, `Community 20`, `Community 21`, `Community 22`, `Community 24`, `Community 25`, `Community 29`, `Community 36`, `Community 39`, `Community 40`, `Community 43`, `Community 51`, `Community 52`, `Community 57`, `Community 58`, `Community 59`, `Community 60`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **Why does `cn()` connect `Community 13` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 15`, `Community 16`, `Community 17`, `Community 19`, `Community 21`, `Community 24`, `Community 29`, `Community 30`, `Community 31`, `Community 36`, `Community 38`, `Community 40`, `Community 43`, `Community 46`, `Community 48`, `Community 49`, `Community 51`, `Community 52`, `Community 56`, `Community 57`, `Community 58`, `Community 59`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **Why does `clsx` connect `Community 7` to `Community 13`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Are the 27 inferred relationships involving `useToast()` (e.g. with `AttendanceMarker()` and `BatchCreator()`) actually correct?**
  _`useToast()` has 27 INFERRED edges - model-reasoned connections that need verification._
- **What connects `extends`, `plugins`, `boundaries/include` to the rest of the system?**
  _260 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07474747474747474 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.07030527289546716 - nodes in this community are weakly interconnected._