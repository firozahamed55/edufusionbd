/**
 * SRA B-2 — turn an `audit_log` row into a sentence a head teacher can read.
 *
 * The dashboard rendered `{action} · {entity}` straight from the table, so the
 * "Recent activity" panel read:
 *
 *     insert · student_enrollment
 *     update · fee_invoice
 *
 * — machine tokens, in English, on a Bengali-first product, naming database
 * tables rather than things a school has. `audit_log.action` is only ever
 * `insert | update | delete` and `entity` is a table name, so the mapping is a
 * small closed table rather than anything clever.
 *
 * Unknown entities fall back to the raw name instead of being dropped: a new
 * table must not make its activity invisible, and seeing `insert · timetable`
 * is a smaller failure than an empty feed.
 */

export type ActionKind = "insert" | "update" | "delete";

/** Bengali needs the noun before the verb, so each entity carries both forms. */
const ENTITY: Record<string, { bn: string; en: string }> = {
  student: { bn: "শিক্ষার্থী", en: "student" },
  student_enrollment: { bn: "শিক্ষার্থী ভর্তি", en: "enrolment" },
  guardian: { bn: "অভিভাবক", en: "guardian" },
  teacher: { bn: "শিক্ষক", en: "teacher" },
  teacher_assignment: { bn: "শিক্ষক নিয়োগ", en: "teaching assignment" },
  fee_invoice: { bn: "ফি বিল", en: "fee invoice" },
  fee_payment: { bn: "ফি আদায়", en: "fee payment" },
  fee_mapping: { bn: "ফি ম্যাপিং", en: "fee mapping" },
  ledger_entry: { bn: "লেজার এন্ট্রি", en: "ledger entry" },
  mark: { bn: "নম্বর", en: "marks" },
  exam: { bn: "পরীক্ষা", en: "exam" },
  exam_result: { bn: "পরীক্ষার ফলাফল", en: "exam result" },
  attendance: { bn: "উপস্থিতি", en: "attendance" },
  notice: { bn: "নোটিশ", en: "notice" },
  sms_campaign: { bn: "এসএমএস ক্যাম্পেইন", en: "SMS campaign" },
  sms_template: { bn: "এসএমএস টেমপ্লেট", en: "SMS template" },
  certificate_template: { bn: "সনদ টেমপ্লেট", en: "certificate template" },
  migration_batch: { bn: "মাইগ্রেশন ব্যাচ", en: "migration batch" },
  setting: { bn: "সেটিংস", en: "setting" },
  class: { bn: "শ্রেণি", en: "class" },
  class_section: { bn: "শ্রেণি-শাখা", en: "class-section" },
  section: { bn: "শাখা", en: "section" },
  subject: { bn: "বিষয়", en: "subject" },
  user_role: { bn: "ইউজার ভূমিকা", en: "user role" },
  profile: { bn: "প্রোফাইল", en: "profile" },
};

const VERB: Record<ActionKind, { bn: string; en: string }> = {
  insert: { bn: "যোগ করা হয়েছে", en: "added" },
  update: { bn: "হালনাগাদ করা হয়েছে", en: "updated" },
  delete: { bn: "মুছে ফেলা হয়েছে", en: "removed" },
};

/** The screen this record lives on, so a feed row is a link and not a dead end. */
const HREF: Record<string, string> = {
  student: "/admin/student/update-class",
  student_enrollment: "/admin/student/update-class",
  guardian: "/admin/student/update-basic",
  teacher: "/admin/teacher/list",
  teacher_assignment: "/admin/teacher/list",
  fee_invoice: "/admin/fee/unpaid-institute",
  fee_payment: "/admin/fee/day-book",
  fee_mapping: "/admin/fee/fee-mapping",
  ledger_entry: "/admin/fee/income-statement",
  mark: "/admin/exam/mark-input",
  exam: "/admin/exam/settings",
  exam_result: "/admin/exam/result-process",
  attendance: "/admin/attendance/report",
  notice: "/admin/sms-notice/notice-board",
  sms_campaign: "/admin/sms-notice/history",
  sms_template: "/admin/sms-notice/templates",
  certificate_template: "/admin/certificate/template",
  migration_batch: "/admin/student/migration-merit",
  setting: "/admin/core/basic-config",
  class: "/admin/core/class",
  class_section: "/admin/core/class",
  section: "/admin/core/class",
  subject: "/admin/core/subject",
  user_role: "/admin/core/user-list",
  profile: "/admin/core/user-list",
};

function isActionKind(v: string): v is ActionKind {
  return v === "insert" || v === "update" || v === "delete";
}

/**
 * A bilingual sentence for one audit row.
 *
 * `count` collapses a run of identical action+entity rows — importing a roster
 * writes 268 `insert · student` entries, which would otherwise fill the whole
 * panel with the same line and push every other event off the dashboard.
 */
export function activitySentence(
  action: string,
  entity: string,
  count = 1,
  /**
   * The run filled the audit fetch window, so `count` is a FLOOR, not a total.
   * Bulk-updating 268 students inside a 200-row page rendered "200 students
   * updated" — the query limit presented as a fact. Rendered "200+".
   */
  partial = false,
): { bn: string; en: string } {
  const e = ENTITY[entity] ?? { bn: entity, en: entity };
  const a = isActionKind(action) ? action : null;
  if (!a) return { bn: `${e.bn} — ${action}`, en: `${e.en} — ${action}` };
  const v = VERB[a];
  if (count > 1) {
    const nn = partial ? `${count}+` : `${count}`;
    return {
      bn: `${nn}টি ${e.bn} ${v.bn}`,
      en: `${nn} ${e.en} records ${v.en}`,
    };
  }
  return { bn: `${e.bn} ${v.bn}`, en: `${capitalise(e.en)} ${v.en}` };
}

export function activityHref(entity: string): string | null {
  return HREF[entity] ?? null;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
