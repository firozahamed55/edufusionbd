export const meta = {
  name: "collect-admin-screens",
  description: "Collect the 54 remaining EduFusionBD admin screens from Figma into their micro-screen folders as themed, content-only components",
  phases: [
    { title: "Collect", detail: "one agent per screen: get_design_context -> rebuild content-only themed component" },
    { title: "Verify", detail: "spot-check each written component for token-only styling and content-only structure" },
  ],
};

const FILE_KEY = "ITLOEUcYUUfPZ82eurKJfb";
const BASE = "d:/New folder/ea/EduFusionBD/edufusionbd-web/src/features/admin";
const GOLDEN = "d:/New folder/ea/EduFusionBD/edufusionbd-web/src/features/admin/dashboard/screens/overview/OverviewScreen.tsx";
const GLOBALS = "d:/New folder/ea/EduFusionBD/edufusionbd-web/src/app/globals.css";

// 54 screens (dashboard/overview already collected as the golden reference).
const SCREENS = [
  // student/registration (77:2) already collected by hand — excluded from re-run.
  ["student", "update-basic", "UpdateBasicScreen", "558:2", "তথ্য হালনাগাদ", "Update Basic"],
  ["student", "update-class", "UpdateClassScreen", "562:2", "শ্রেণি হালনাগাদ", "Update Class"],
  ["student", "migration-merit", "MigrationMeritScreen", "90:2", "মাইগ্রেশন (মেধা)", "Migration Merit"],
  ["student", "migration-nomerit", "MigrationNomeritScreen", "92:2", "মাইগ্রেশন (মেধা ছাড়া)", "Migration No-Merit"],
  ["student", "migration-pushback", "MigrationPushbackScreen", "94:2", "মাইগ্রেশন পুশব্যাক", "Migration Pushback"],
  ["student", "reports-summary", "ReportsSummaryScreen", "96:2", "সারাংশ প্রতিবেদন", "Reports Summary"],
  ["teacher", "registration", "RegistrationScreen", "139:2", "নিবন্ধন", "Registration"],
  // teacher/list (146:2) already collected by hand — excluded from re-run.
  ["teacher", "update-profile", "UpdateProfileScreen", "161:2", "প্রোফাইল হালনাগাদ", "Update Profile"],
  ["attendance", "section", "SectionScreen", "386:2", "সেকশন উপস্থিতি", "Section"],
  ["attendance", "exam", "ExamScreen", "528:2", "পরীক্ষা উপস্থিতি", "Exam"],
  ["attendance", "update-section", "UpdateSectionScreen", "659:2", "সেকশন সংশোধন", "Update Section"],
  ["attendance", "update-exam", "UpdateExamScreen", "639:2", "পরীক্ষা সংশোধন", "Update Exam"],
  ["attendance", "report", "ReportScreen", "398:2", "প্রতিবেদন", "Report"],
  ["attendance", "analytics", "AnalyticsScreen", "670:2", "বিশ্লেষণ", "Analytics"],
  ["exam", "settings", "SettingsScreen", "169:2", "সেটিংস", "Settings"],
  ["exam", "mark-config", "MarkConfigScreen", "524:2", "মার্ক কনফিগ", "Mark Config"],
  ["exam", "marksheet-config", "MarksheetConfigScreen", "525:2", "মার্কশিট কনফিগ", "Marksheet Config"],
  ["exam", "comment-config", "CommentConfigScreen", "525:720", "মন্তব্য কনফিগ", "Comment Config"],
  ["exam", "date-config", "DateConfigScreen", "525:1438", "তারিখ কনফিগ", "Date Config"],
  ["exam", "mark-input", "MarkInputScreen", "180:2", "মার্ক এন্ট্রি", "Mark Input"],
  ["exam", "mark-update", "MarkUpdateScreen", "226:2", "মার্ক সংশোধন", "Mark Update"],
  ["exam", "mark-process", "MarkProcessScreen", "230:2", "মার্ক প্রসেস", "Mark Process"],
  ["exam", "result-process", "ResultProcessScreen", "193:2", "ফলাফল প্রসেস", "Result Process"],
  ["exam", "result-sheet-download", "ResultSheetDownloadScreen", "880:2", "রেজাল্ট শিট", "Result Sheet"],
  ["fee", "quick-collection-list", "QuickCollectionListScreen", "465:2", "দ্রুত আদায় তালিকা", "Quick Collection List"],
  ["fee", "quick-collection-form", "QuickCollectionFormScreen", "449:2", "দ্রুত আদায়", "Quick Collection"],
  ["fee", "digital-collection", "DigitalCollectionScreen", "453:2", "ডিজিটাল আদায়", "Digital Collection"],
  ["fee", "unpaid-section", "UnpaidSectionScreen", "400:2", "বকেয়া (সেকশন)", "Unpaid Section"],
  ["fee", "unpaid-institute", "UnpaidInstituteScreen", "444:2", "বকেয়া (প্রতিষ্ঠান)", "Unpaid Institute"],
  ["fee", "income-statement", "IncomeStatementScreen", "447:2", "আয় বিবরণী", "Income Statement"],
  ["fee", "fee-mapping", "FeeMappingScreen", "456:2", "ফি ম্যাপিং", "Fee Mapping"],
  ["fee", "delete-fees", "DeleteFeesScreen", "459:2", "ফি মুছুন", "Delete Fees"],
  ["certificate", "template", "TemplateScreen", "201:2", "টেমপ্লেট", "Template"],
  ["certificate", "admit-instruction", "AdmitInstructionScreen", "235:2", "প্রবেশপত্র নির্দেশনা", "Admit Instruction"],
  ["certificate", "exam-essentials", "ExamEssentialsScreen", "244:2", "পরীক্ষা সামগ্রী", "Exam Essentials"],
  ["certificate", "id-card", "IdCardScreen", "819:2", "আইডি কার্ড", "ID Card"],
  ["certificate", "admit-card", "AdmitCardScreen", "839:2", "প্রবেশপত্র", "Admit Card"],
  ["certificate", "testimonial", "TestimonialScreen", "245:2", "প্রশংসাপত্র", "Testimonial"],
  ["certificate", "transfer", "TransferScreen", "238:2", "ট্রান্সফার সনদ", "Transfer Certificate"],
  ["sms-notice", "send", "SendScreen", "246:2", "এসএমএস পাঠান", "Send"],
  ["sms-notice", "templates", "TemplatesScreen", "256:2", "টেমপ্লেট", "Templates"],
  ["sms-notice", "history", "HistoryScreen", "258:2", "প্রেরিত ইতিহাস", "Sent History"],
  ["sms-notice", "notice-board", "NoticeBoardScreen", "260:2", "নোটিশ বোর্ড", "Notice Board"],
  ["sms-notice", "balance-purchase", "BalancePurchaseScreen", "262:2", "ব্যালেন্স ও ক্রয়", "Balance & Purchase"],
  ["core", "startup", "StartupScreen", "112:2", "স্টার্টআপ", "StartUp"],
  ["core", "basic-config", "BasicConfigScreen", "115:2", "মৌলিক কনফিগ", "Basic Config"],
  ["core", "class", "ClassScreen", "116:2", "শ্রেণি কনফিগ", "Class Config"],
  ["core", "subject", "SubjectScreen", "119:2", "বিষয় তালিকা", "Subject List"],
  ["core", "subject-group", "SubjectGroupScreen", "124:2", "বিষয় গ্রুপ", "Subject Group"],
  ["core", "grading", "GradingScreen", "120:2", "গ্রেডিং স্কিম", "Grading Scheme"],
  ["core", "signature", "SignatureScreen", "118:2", "স্বাক্ষর", "Signature"],
  ["core", "user-list", "UserListScreen", "121:2", "ইউজার তালিকা", "User List"],
];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    slug: { type: "string" },
    ok: { type: "boolean" },
    sections: { type: "number" },
    usedLucide: { type: "boolean" },
    contentOnly: { type: "boolean" },
    notes: { type: "string" },
  },
  required: ["slug", "ok", "notes"],
};

function collectPrompt([module, slug, comp, light, bn, en]) {
  const target = `${BASE}/${module}/screens/${slug}/${comp}.tsx`;
  return `You are a senior React/Next.js engineer collecting ONE admin screen from Figma into the EduFusionBD app. Produce a COMPILING, content-only, theme-safe component.

SCREEN: ${module}/${slug} — "${bn}" (${en})
FIGMA: fileKey ${FILE_KEY}, LIGHT nodeId ${light}
TARGET FILE (overwrite the stub, keep the exact path): ${target}
EXPORT NAME (must stay exactly): export function ${comp}() { ... }

STEP 1 — Learn the target style + tokens (Read these):
  - ${GOLDEN}  ← THE exemplar. Match its structure, spacing, sub-component style, and token usage.
  - ${GLOBALS} ← the available semantic token utilities.

STEP 2 — Pull the design:
  - Run ToolSearch with query "select:mcp__claude_ai_Figma__get_design_context", then call get_design_context with fileKey ${FILE_KEY} and nodeId ${light}.
  - The SCREENSHOT is the source of truth for layout & content. The returned code is reference for exact Bengali text, numbers, table columns, and field labels. (If the code is truncated, rebuild from the screenshot.)

STEP 3 — Rebuild as a SINGLE content-only component and Write it to the target file:
  - CONTENT ONLY: do NOT render the sidebar or the topbar — the shared AdminShell already does. Reproduce ONLY the inner content area (page header/title + its sections: stat cards, tables, forms, filters, wizards, cards, empty states).
  - THEME-SAFE: style with ONLY semantic token utilities so light+dark both work from one path. Allowed color utilities: bg-canvas, bg-surface, bg-sunken, border-border-default, border-border-strong, text-text-primary, text-text-secondary, text-text-muted, bg-primary, text-primary, text-text-on-primary, bg-primary-hover, bg-primary-subtle, and status pairs bg-success-bg/text-success-fg, bg-warning-bg/text-warning-fg, bg-danger-bg/text-danger-fg, bg-info-bg/text-info-fg (plus bg-danger-fg for destructive buttons). NEVER hardcode hex colors. Use layout/spacing/radius/shadow Tailwind utilities freely (shadow via shadow-[var(--shadow-e3)]).
  - ICONS: use lucide-react icons imported by name. NEVER reference figma asset URLs or <img src> from Figma (they expire).
  - Keep ALL Bengali labels and numbers exactly as designed. Wrap the whole thing in <div className="mx-auto flex max-w-[1200px] flex-col gap-6"> like the exemplar. Local sub-components in the same file are encouraged. Import cn from "@/shared/lib/cn" if useful. Add NO new dependencies beyond lucide-react.
  - Valid TSX that will pass tsc. No default export. No "use client" unless it uses hooks/handlers (prefer none). Static placeholder data matching the design (real data wiring is a later phase).

Then return the JSON summary. Be faithful to the Figma layout and match the exemplar's polish.`;
}

function verifyPrompt([module, slug, comp]) {
  const target = `${BASE}/${module}/screens/${slug}/${comp}.tsx`;
  return `Read ${target} and check it as a code reviewer. Confirm: (1) it exports "export function ${comp}(", (2) it renders CONTENT ONLY — no sidebar/topbar, (3) NO hardcoded hex colors and NO figma asset URLs / <img> remote src, (4) it is plausibly valid TSX. If any check fails, FIX the file in place (minimal edits) and re-save. Return the JSON summary with notes on what you found/fixed.`;
}

phase("Collect");
const results = await pipeline(
  SCREENS,
  (s) => agent(collectPrompt(s), { label: `collect:${s[0]}/${s[1]}`, phase: "Collect", schema: SCHEMA }),
  (r, s) => agent(verifyPrompt(s), { label: `verify:${s[0]}/${s[1]}`, phase: "Verify", schema: SCHEMA }),
);

const done = results.filter(Boolean);
const failed = done.filter((r) => r && r.ok === false).map((r) => r.slug);
log(`Collected ${done.length}/${SCREENS.length}. Issues: ${failed.length ? failed.join(", ") : "none"}`);

return {
  total: SCREENS.length,
  completed: done.length,
  failedSlugs: failed,
  results: done,
};
