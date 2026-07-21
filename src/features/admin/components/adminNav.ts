import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CalendarCheck,
  ClipboardList,
  Wallet,
  BarChart3,
  Award,
  MessageSquare,
  Settings,
  Sparkles,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export type AdminSubItem = {
  href: string;
  /** Path prefix(es) that mark this sub-item active (defaults to exact `href` prefix). */
  match?: string | string[];
  bn: string;
  en: string;
};

export type AdminSubGroup = {
  /** Optional group heading inside the sub panel (used by Core Settings). */
  label: { bn: string; en: string } | null;
  items: AdminSubItem[];
};

export type AdminNavItem = {
  key: string;
  href: string;
  /** Path prefix that marks this item active (defaults to `/admin/<key>`). */
  match?: string;
  icon: LucideIcon;
  bn: string;
  en: string;
  /** Sidebar sub-navigation — mirrors the Figma expanded sub-item panel. */
  sub?: AdminSubGroup[];
};

export type AdminNavSection = {
  label: { bn: string; en: string } | null;
  items: AdminNavItem[];
};

const sub = (items: AdminSubItem[]): AdminSubGroup[] => [{ label: null, items }];

/** Grouped sidebar with per-module sub-items, mirroring the Figma admin design. */
export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    label: null,
    items: [
      { key: "dashboard", href: "/admin/dashboard", icon: LayoutDashboard, bn: "ড্যাশবোর্ড", en: "Dashboard" },
      {
        key: "student",
        href: "/admin/student/registration",
        match: "/admin/student",
        icon: Users,
        bn: "শিক্ষার্থী তথ্য",
        en: "Students",
        sub: [
          {
            label: null,
            items: [
              { href: "/admin/student/registration", bn: "নিবন্ধন (ভর্তি)", en: "Registration (Admission)" },
              { href: "/admin/student/update-basic", bn: "তথ্য হালনাগাদ", en: "Update Info" },
              { href: "/admin/student/update-class", bn: "শ্রেণি পরিবর্তন", en: "Change Class" },
            ],
          },
          {
            label: { bn: "মাইগ্রেশন", en: "Migration" },
            items: [
              { href: "/admin/student/migration-merit", bn: "মেধাক্রমসহ", en: "With Merit" },
              { href: "/admin/student/migration-nomerit", bn: "মেধাক্রম ছাড়া", en: "Without Merit" },
              { href: "/admin/student/migration-pushback", bn: "পুশব্যাক", en: "Push Back" },
            ],
          },
          {
            label: null,
            items: [{ href: "/admin/student/reports-summary", bn: "রিপোর্ট", en: "Reports" }],
          },
        ],
      },
      {
        key: "teacher",
        href: "/admin/teacher/registration",
        icon: GraduationCap,
        bn: "শিক্ষক ও কর্মী",
        en: "Teachers & Staff",
        sub: sub([
          { href: "/admin/teacher/registration", bn: "নিবন্ধন (নতুন)", en: "Registration (New)" },
          { href: "/admin/teacher/update-profile", bn: "প্রোফাইল হালনাগাদ", en: "Update Profile" },
          { href: "/admin/teacher/list", bn: "শিক্ষক তালিকা", en: "Teacher List" },
        ]),
      },
    ],
  },
  {
    label: { bn: "একাডেমিক", en: "Academic" },
    items: [
      {
        key: "attendance",
        href: "/admin/attendance/section",
        icon: CalendarCheck,
        bn: "উপস্থিতি",
        en: "Attendance",
        sub: sub([
          { href: "/admin/attendance/section", bn: "সেকশন উপস্থিতি", en: "Section Attendance" },
          { href: "/admin/attendance/exam", bn: "পরীক্ষা উপস্থিতি", en: "Exam Attendance" },
          { href: "/admin/attendance/update-section", bn: "সেকশন আপডেট", en: "Update Section" },
          { href: "/admin/attendance/update-exam", bn: "পরীক্ষা আপডেট", en: "Update Exam" },
          { href: "/admin/attendance/report", bn: "উপস্থিতি রিপোর্ট", en: "Attendance Report" },
          { href: "/admin/attendance/analytics", bn: "বিশ্লেষণ", en: "Analytics" },
        ]),
      },
      {
        key: "exam",
        href: "/admin/exam/settings",
        icon: ClipboardList,
        bn: "পরীক্ষা ও ফলাফল",
        en: "Exam & Results",
        sub: [
          {
            label: { bn: "সেটআপ", en: "Setup" },
            items: [
              { href: "/admin/exam/settings", bn: "সাধারণ সেটিংস", en: "General Settings" },
              { href: "/admin/exam/mark-config", bn: "মার্ক কনফিগ", en: "Mark Config" },
              { href: "/admin/exam/marksheet-config", bn: "মার্কশিট কনফিগ", en: "Marksheet Config" },
              { href: "/admin/exam/comment-config", bn: "মন্তব্য কনফিগ", en: "Comment Config" },
              { href: "/admin/exam/date-config", bn: "তারিখ কনফিগ", en: "Date Config" },
            ],
          },
          {
            label: { bn: "মার্ক ও ফলাফল", en: "Marks & Results" },
            items: [
              { href: "/admin/exam/mark-input", bn: "মার্ক ইনপুট", en: "Mark Input" },
              { href: "/admin/exam/mark-update", bn: "মার্ক আপডেট", en: "Mark Update" },
              { href: "/admin/exam/mark-process", bn: "মার্ক প্রসেস", en: "Mark Process" },
              { href: "/admin/exam/result-process", bn: "ফলাফল প্রসেস", en: "Result Process" },
              { href: "/admin/exam/result-sheet-download", bn: "রেজাল্ট শীট", en: "Result Sheet" },
            ],
          },
        ],
      },
      {
        key: "fee",
        href: "/admin/fee/quick-collection-list",
        icon: Wallet,
        bn: "ফি ও অর্থ",
        en: "Fee & Finance",
        sub: sub([
          { href: "/admin/fee/quick-collection-list", bn: "কুইক কালেকশন", en: "Quick Collection" },
          { href: "/admin/fee/quick-collection-form", bn: "কালেকশন ফর্ম", en: "Collection Form" },
          { href: "/admin/fee/digital-collection", bn: "ডিজিটাল ফি কালেকশন", en: "Digital Fee Collection" },
          { href: "/admin/fee/unpaid-section", bn: "বকেয়া (সেকশন)", en: "Unpaid (Section)" },
          { href: "/admin/fee/unpaid-institute", bn: "বকেয়া (প্রতিষ্ঠান)", en: "Unpaid (Institute)" },
          { href: "/admin/fee/income-statement", bn: "আয় বিবরণী", en: "Income Statement" },
          { href: "/admin/fee/fee-mapping", bn: "ফি ম্যাপিং", en: "Fee Mapping" },
          { href: "/admin/fee/delete-fees", bn: "ফি মুছুন", en: "Delete Fees" },
        ]),
      },
      { key: "report", href: "/admin/student/reports-summary", match: "/admin/student/reports-summary", icon: BarChart3, bn: "রিপোর্ট", en: "Reports" },
    ],
  },
  {
    label: { bn: "ম্যানেজমেন্ট", en: "Management" },
    items: [
      {
        key: "certificate",
        href: "/admin/certificate/template",
        icon: Award,
        bn: "সার্টিফিকেট",
        en: "Certificate",
        sub: sub([
          { href: "/admin/certificate/template", bn: "টেমপ্লেট ফরম্যাট", en: "Template Format" },
          { href: "/admin/certificate/admit-instruction", bn: "অ্যাডমিট নির্দেশনা", en: "Admit Instructions" },
          { href: "/admin/certificate/id-card", bn: "আইডি কার্ড", en: "ID Card" },
          { href: "/admin/certificate/exam-essentials", bn: "পরীক্ষা উপকরণ", en: "Exam Essentials" },
          { href: "/admin/certificate/admit-card", bn: "অ্যাডমিট কার্ড", en: "Admit Card" },
          { href: "/admin/certificate/testimonial", bn: "প্রশংসাপত্র", en: "Testimonial" },
          { href: "/admin/certificate/transfer", bn: "ট্রান্সফার সনদ", en: "Transfer Certificate" },
        ]),
      },
      {
        key: "sms-notice",
        href: "/admin/sms-notice/send",
        icon: MessageSquare,
        bn: "এসএমএস ও নোটিশ",
        en: "SMS & Notice",
        sub: sub([
          { href: "/admin/sms-notice/send", bn: "এসএমএস পাঠান", en: "Send SMS" },
          { href: "/admin/sms-notice/notice-board", bn: "নোটিশ বোর্ড", en: "Notice Board" },
          { href: "/admin/sms-notice/templates", bn: "টেমপ্লেট", en: "Templates" },
          { href: "/admin/sms-notice/history", bn: "পাঠানো ইতিহাস", en: "Sent History" },
          { href: "/admin/sms-notice/balance-purchase", bn: "ব্যালেন্স ও ক্রয়", en: "Balance & Purchase" },
        ]),
      },
      {
        key: "core",
        href: "/admin/core/basic-config",
        icon: Settings,
        bn: "কোর সেটিংস",
        en: "Core Settings",
        sub: [
          {
            label: { bn: "প্রতিষ্ঠান সেটিংস", en: "Institution Settings" },
            items: [
              { href: "/admin/core/basic-config", bn: "বেসিক কনফিগ", en: "Basic Config" },
              { href: "/admin/core/startup", bn: "স্টার্টআপ", en: "StartUp" },
              { href: "/admin/core/class", bn: "ক্লাস কনফিগ", en: "Class Config" },
              { href: "/admin/core/signature", bn: "স্বাক্ষর", en: "Signature" },
            ],
          },
          {
            label: { bn: "বিষয় সেটিংস", en: "Subject Settings" },
            items: [
              { href: "/admin/core/subject", bn: "বিষয় তালিকা", en: "Subject List" },
              { href: "/admin/core/subject-group", bn: "বিষয় গ্রুপ", en: "Subject Group" },
              { href: "/admin/core/grading", bn: "গ্রেডিং স্কিম", en: "Grading Scheme" },
            ],
          },
          {
            label: { bn: "ইউজার সেটিংস", en: "User Settings" },
            items: [
              { href: "/admin/core/user-list", bn: "ইউজার তালিকা", en: "User List" },
              { href: "/admin/core/audit-log", bn: "পরিবর্তনের ইতিহাস", en: "Audit Log" },
            ],
          },
        ],
      },
    ],
  },
];

export const ADMIN_NAV_FOOTER: AdminNavItem[] = [
  { key: "edusathi", href: "/admin/edusathi", icon: Sparkles, bn: "এডুসাথী", en: "EduSathi" },
  { key: "settings", href: "/admin/core/basic-config", match: "/admin/settings", icon: SlidersHorizontal, bn: "সেটিংস", en: "Settings" },
];
