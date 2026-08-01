import {
  LayoutDashboard,
  Sparkles,
  Users,
  GraduationCap,
  CalendarCheck,
  ClipboardList,
  Wallet,
  Award,
  MessageSquare,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

/**
 * Admin IA — rail addresses AREAS, the page addresses SCREENS within an area
 * (final_admin.md §8, D1). The rail used to carry all 56 leaf routes; it now
 * carries 10 modules + Settings, grouped into 5 zones. Every existing URL is
 * preserved (§8.4) — this is a presentation-layer regrouping, not a route
 * migration, so nothing that already worked can break.
 *
 * A module's screens render as `ModuleTabs` on the page (see
 * shared/ui/ModuleTabs.tsx) instead of a sidebar flyout — visible on arrival,
 * not revealed only by navigating (closes N-4/N-6). `group` on a tab renders
 * a small heading before it, for modules whose real screen count exceeds the
 * ≤5 target (Exam's Setup/Marks split, Core's 3 settings groups, Students'
 * Migration cluster) — mirrors what `SettingsShell` already did for Exam,
 * generalised app-wide.
 */

export type AdminTab = {
  href: string;
  /** Path prefix(es) that mark this tab active (defaults to exact `href` prefix). */
  match?: string | string[];
  bn: string;
  en: string;
  /** Optional group heading rendered before this tab (and any tabs sharing it). */
  group?: { bn: string; en: string };
};

export type AdminModule = {
  key: string;
  /** Landing route when the rail item itself is clicked. */
  href: string;
  /** Prefix used for longest-match zone-active resolution. */
  match: string;
  icon: LucideIcon;
  bn: string;
  en: string;
  /** Visual accent treatment (EduSathi). */
  accent?: boolean;
  /**
   * The permission code that makes this module usable (SRA F-4 / A-0.4).
   *
   * Filtering on a PERMISSION rather than on the JWT role is the point. The
   * JWT role answers "may this person reach /admin at all" — middleware's job,
   * unchanged — while the database models access as permissions, and those are
   * what every RLS policy and RPC guard is written against. Keying the rail to
   * the same codes means navigation and authorization agree by construction
   * instead of by two lists someone has to remember to keep in sync.
   *
   * `roles?: readonly Role[]` used to live here, filtered on `admin | teacher |
   * parent | student | super_admin`, and was set by exactly nothing — a
   * vocabulary the database never shared.
   */
  permission?: string;
  /** Omitted => single-screen module, no tab bar (Dashboard, EduSathi, Reports). */
  tabs?: AdminTab[];
};

export type AdminZone = {
  label: { bn: string; en: string } | null;
  items: AdminModule[];
};

export const ADMIN_NAV_ZONES: AdminZone[] = [
  {
    label: { bn: "ওভারভিউ", en: "Overview" },
    items: [
      { key: "dashboard", href: "/admin/dashboard", match: "/admin/dashboard", icon: LayoutDashboard, bn: "ড্যাশবোর্ড", en: "Dashboard", permission: "dashboard.view" },
      { key: "edusathi", href: "/admin/edusathi", match: "/admin/edusathi", icon: Sparkles, bn: "এডুসাথী এআই", en: "EduSathi AI", accent: true, permission: "dashboard.view" },
    ],
  },
  {
    label: { bn: "মানুষ", en: "People" },
    items: [
      {
        key: "student",
        href: "/admin/student/registration",
        match: "/admin/student",
        icon: Users,
        bn: "শিক্ষার্থী",
        en: "Students",
        permission: "student.view",
        tabs: [
          { href: "/admin/student/registration", bn: "ভর্তি", en: "Admissions" },
          { href: "/admin/student/update-basic", bn: "তথ্য হালনাগাদ", en: "Update Info" },
          { href: "/admin/student/update-class", bn: "শ্রেণি পরিবর্তন", en: "Change Class" },
          { href: "/admin/student/migration-merit", bn: "মেধাক্রমসহ", en: "With Merit", group: { bn: "মাইগ্রেশন", en: "Migration" } },
          { href: "/admin/student/migration-nomerit", bn: "মেধাক্রম ছাড়া", en: "Without Merit", group: { bn: "মাইগ্রেশন", en: "Migration" } },
          { href: "/admin/student/migration-pushback", bn: "পুশব্যাক", en: "Push Back", group: { bn: "মাইগ্রেশন", en: "Migration" } },
          { href: "/admin/student/reports-summary", bn: "রিপোর্ট", en: "Reports" },
        ],
      },
      {
        key: "teacher",
        href: "/admin/teacher/list",
        match: "/admin/teacher",
        icon: GraduationCap,
        bn: "শিক্ষক ও কর্মী",
        en: "Teachers & Staff",
        permission: "teacher.view",
        tabs: [
          { href: "/admin/teacher/list", bn: "শিক্ষক তালিকা", en: "Directory" },
          { href: "/admin/teacher/registration", bn: "নিবন্ধন", en: "Onboarding" },
          { href: "/admin/teacher/update-profile", bn: "প্রোফাইল হালনাগাদ", en: "Profiles" },
        ],
      },
    ],
  },
  {
    label: { bn: "একাডেমিক", en: "Academics" },
    items: [
      {
        key: "attendance",
        href: "/admin/attendance/section",
        match: "/admin/attendance",
        icon: CalendarCheck,
        bn: "উপস্থিতি",
        en: "Attendance",
        permission: "attendance.view",
        tabs: [
          { href: "/admin/attendance/section", bn: "সেকশন উপস্থিতি", en: "Take (Section)" },
          { href: "/admin/attendance/exam", bn: "পরীক্ষা উপস্থিতি", en: "Take (Exam)" },
          { href: "/admin/attendance/update-section", bn: "সেকশন আপডেট", en: "Update (Section)" },
          { href: "/admin/attendance/update-exam", bn: "পরীক্ষা আপডেট", en: "Update (Exam)" },
          { href: "/admin/attendance/report", bn: "রিপোর্ট", en: "Report" },
          { href: "/admin/attendance/analytics", bn: "বিশ্লেষণ", en: "Analytics" },
        ],
      },
      {
        key: "exam",
        href: "/admin/exam/settings",
        match: "/admin/exam",
        icon: ClipboardList,
        bn: "পরীক্ষা ও ফলাফল",
        en: "Exam & Results",
        permission: "exam.view",
        tabs: [
          { href: "/admin/exam/settings", bn: "সাধারণ সেটিংস", en: "General Settings", group: { bn: "সেটআপ", en: "Setup" } },
          { href: "/admin/exam/mark-config", bn: "মার্ক কনফিগ", en: "Mark Config", group: { bn: "সেটআপ", en: "Setup" } },
          { href: "/admin/exam/marksheet-config", bn: "মার্কশিট কনফিগ", en: "Marksheet Config", group: { bn: "সেটআপ", en: "Setup" } },
          { href: "/admin/exam/comment-config", bn: "মন্তব্য কনফিগ", en: "Comment Config", group: { bn: "সেটআপ", en: "Setup" } },
          { href: "/admin/exam/date-config", bn: "তারিখ কনফিগ", en: "Date Config", group: { bn: "সেটআপ", en: "Setup" } },
          { href: "/admin/exam/mark-input", bn: "মার্ক ইনপুট", en: "Mark Input", group: { bn: "মার্ক ও ফলাফল", en: "Marks & Results" } },
          { href: "/admin/exam/mark-update", bn: "মার্ক আপডেট", en: "Mark Update", group: { bn: "মার্ক ও ফলাফল", en: "Marks & Results" } },
          { href: "/admin/exam/mark-process", bn: "মার্ক প্রসেস", en: "Mark Process", group: { bn: "মার্ক ও ফলাফল", en: "Marks & Results" } },
          { href: "/admin/exam/result-process", bn: "ফলাফল প্রসেস", en: "Result Process", group: { bn: "মার্ক ও ফলাফল", en: "Marks & Results" } },
          { href: "/admin/exam/result-sheet-download", bn: "রেজাল্ট শীট", en: "Result Sheet", group: { bn: "মার্ক ও ফলাফল", en: "Marks & Results" } },
        ],
      },
    ],
  },
  {
    label: { bn: "অপারেশনস", en: "Operations" },
    items: [
      {
        key: "fee",
        href: "/admin/fee/quick-collection-list",
        match: "/admin/fee",
        icon: Wallet,
        bn: "ফি ও অর্থ",
        en: "Fees & Finance",
        permission: "fee.view",
        tabs: [
          { href: "/admin/fee/quick-collection-list", bn: "কুইক কালেকশন", en: "Quick Collection", group: { bn: "কালেকশন", en: "Collection" } },
          { href: "/admin/fee/quick-collection-form", bn: "কালেকশন ফর্ম", en: "Collection Form", group: { bn: "কালেকশন", en: "Collection" } },
          { href: "/admin/fee/digital-collection", bn: "ডিজিটাল ফি কালেকশন", en: "Digital Collection" },
          { href: "/admin/fee/unpaid-section", bn: "বকেয়া (সেকশন)", en: "Unpaid (Section)", group: { bn: "বকেয়া", en: "Unpaid" } },
          { href: "/admin/fee/unpaid-institute", bn: "বকেয়া (প্রতিষ্ঠান)", en: "Unpaid (Institute)", group: { bn: "বকেয়া", en: "Unpaid" } },
          { href: "/admin/fee/day-book", bn: "দৈনিক হিসাব", en: "Day Book", group: { bn: "কালেকশন", en: "Collection" } },
          { href: "/admin/fee/income-statement", bn: "আয় বিবরণী", en: "Income Statement" },
          { href: "/admin/fee/fee-mapping", bn: "ফি ম্যাপিং", en: "Fee Mapping" },
          { href: "/admin/fee/delete-fees", bn: "ফি মুছুন", en: "Delete Fees" },
        ],
      },
      {
        key: "certificate",
        href: "/admin/certificate/template",
        match: "/admin/certificate",
        icon: Award,
        bn: "ডকুমেন্টস",
        en: "Documents",
        permission: "certificate.view",
        tabs: [
          { href: "/admin/certificate/template", bn: "টেমপ্লেট ফরম্যাট", en: "Template Format" },
          { href: "/admin/certificate/id-card", bn: "আইডি কার্ড", en: "ID Card" },
          { href: "/admin/certificate/admit-instruction", bn: "অ্যাডমিট নির্দেশনা", en: "Admit Instructions" },
          { href: "/admin/certificate/exam-essentials", bn: "পরীক্ষা উপকরণ", en: "Exam Essentials" },
          { href: "/admin/certificate/admit-card", bn: "অ্যাডমিট কার্ড", en: "Admit Card" },
          { href: "/admin/certificate/testimonial", bn: "প্রশংসাপত্র", en: "Testimonial" },
          { href: "/admin/certificate/transfer", bn: "ট্রান্সফার সনদ", en: "Transfer Certificate" },
        ],
      },
      {
        key: "sms-notice",
        href: "/admin/sms-notice/send",
        match: "/admin/sms-notice",
        icon: MessageSquare,
        bn: "কমিউনিকেশন",
        en: "Communication",
        permission: "sms.view",
        tabs: [
          { href: "/admin/sms-notice/send", bn: "এসএমএস পাঠান", en: "Send SMS" },
          { href: "/admin/sms-notice/notice-board", bn: "নোটিশ বোর্ড", en: "Notice Board" },
          { href: "/admin/sms-notice/templates", bn: "টেমপ্লেট", en: "Templates" },
          { href: "/admin/sms-notice/history", bn: "পাঠানো ইতিহাস", en: "Sent History" },
          { href: "/admin/sms-notice/balance-purchase", bn: "ব্যালেন্স ও ক্রয়", en: "Balance & Purchase" },
        ],
      },
    ],
  },
  {
    label: { bn: "ইনসাইটস", en: "Insights" },
    items: [
      // Canonical single home for Reports (closes N-2: this used to also exist
      // as a top-level "Reports" entry AND a Students sub-item, both active on
      // the same route at once). Same physical route as the Students tab.
      { key: "report", href: "/admin/student/reports-summary", match: "/admin/student/reports-summary", icon: BarChart3, bn: "রিপোর্ট", en: "Reports", permission: "student.view" },
    ],
  },
];

export const ADMIN_SETTINGS_MODULE: AdminModule = {
  key: "core",
  href: "/admin/core/basic-config",
  match: "/admin/core",
  icon: Settings,
  bn: "সেটিংস",
  en: "Settings",
  permission: "core.settings",
  tabs: [
    { href: "/admin/core/basic-config", bn: "বেসিক কনফিগ", en: "Basic Config", group: { bn: "প্রতিষ্ঠান", en: "Institution" } },
    { href: "/admin/core/startup", bn: "স্টার্টআপ", en: "StartUp", group: { bn: "প্রতিষ্ঠান", en: "Institution" } },
    { href: "/admin/core/class", bn: "ক্লাস কনফিগ", en: "Class Config", group: { bn: "প্রতিষ্ঠান", en: "Institution" } },
    { href: "/admin/core/signature", bn: "স্বাক্ষর", en: "Signature", group: { bn: "প্রতিষ্ঠান", en: "Institution" } },
    { href: "/admin/core/subject", bn: "বিষয় তালিকা", en: "Subject List", group: { bn: "বিষয়", en: "Subjects" } },
    { href: "/admin/core/subject-group", bn: "বিষয় গ্রুপ", en: "Subject Group", group: { bn: "বিষয়", en: "Subjects" } },
    { href: "/admin/core/grading", bn: "গ্রেডিং স্কিম", en: "Grading Scheme", group: { bn: "বিষয়", en: "Subjects" } },
    { href: "/admin/core/user-list", bn: "ইউজার ও ভূমিকা", en: "Users & Roles", group: { bn: "ইউজার", en: "Users" } },
    { href: "/admin/core/permissions", bn: "অনুমতি ম্যাট্রিক্স", en: "Permission Matrix", group: { bn: "ইউজার", en: "Users" } },
    { href: "/admin/core/audit-log", bn: "পরিবর্তনের ইতিহাস", en: "Audit Log", group: { bn: "ইউজার", en: "Users" } },
  ],
};

/**
 * Whether the rail should show a module, given the caller's permission codes
 * from `fn_my_permissions()` (SRA F-4).
 *
 * PERMISSIVE UNTIL PROVEN OTHERWISE. `undefined` (still loading) and `[]` (an
 * account whose `user_role` rows were never seeded) both show everything.
 * Failing open is deliberate: an empty rail reads as a broken product rather
 * than as an access decision, and that is exactly the rollout failure risk R-5
 * names. RLS is the control; this is only the map.
 */
export function canSeeModule(mod: AdminModule, permissions: readonly string[] | undefined): boolean {
  if (!mod.permission) return true;
  if (!permissions || permissions.length === 0) return true;
  return permissions.includes(mod.permission);
}

/** Every module in rail order — used for longest-prefix active resolution and the command palette. */
export const ADMIN_ALL_MODULES: AdminModule[] = [
  ...ADMIN_NAV_ZONES.flatMap((z) => z.items),
  ADMIN_SETTINGS_MODULE,
];
