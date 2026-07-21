/**
 * Parent module demo data + types. The parent app UI is data-driven off these
 * shapes; wiring to Supabase/RLS replaces `getChildren()` with a query keyed by
 * the authenticated guardian. Kept in one file so screens stay presentational.
 */

export type Child = {
  id: string;
  name: { bn: string; en: string };
  initial: { bn: string; en: string };
  className: { bn: string; en: string };
  roll: number;
  attendancePct: number;
  presentDays: number;
  totalDays: number;
  todayStatus: "present" | "absent" | "leave";
  feeDue: number;
  feeMonth: { bn: string; en: string };
  feeDueDate: { bn: string; en: string };
  gpa: string;
  examName: { bn: string; en: string };
  meritPosition: number;
};

export type Notice = {
  id: string;
  title: { bn: string; en: string };
  body: { bn: string; en: string };
  ageDays: number;
  isNew: boolean;
};

export const CHILDREN: Child[] = [
  {
    id: "tania",
    name: { bn: "তানিয়া", en: "Tania" },
    initial: { bn: "তা", en: "T" },
    className: { bn: "৭ম শ্রেণি · খ শাখা", en: "Class 7 · Section B" },
    roll: 12,
    attendancePct: 94,
    presentDays: 22,
    totalDays: 23,
    todayStatus: "present",
    feeDue: 3200,
    feeMonth: { bn: "জুন ২০২৬", en: "June 2026" },
    feeDueDate: { bn: "শেষ তারিখ ১৫ জুন", en: "Due 15 June" },
    gpa: "4.83",
    examName: { bn: "অর্ধবার্ষিক পরীক্ষা", en: "Half-yearly exam" },
    meritPosition: 3,
  },
  {
    id: "rakib",
    name: { bn: "রাকিব", en: "Rakib" },
    initial: { bn: "রা", en: "R" },
    className: { bn: "৫ম শ্রেণি · ক শাখা", en: "Class 5 · Section A" },
    roll: 7,
    attendancePct: 88,
    presentDays: 20,
    totalDays: 23,
    todayStatus: "present",
    feeDue: 0,
    feeMonth: { bn: "জুন ২০২৬", en: "June 2026" },
    feeDueDate: { bn: "পরিশোধিত", en: "Paid" },
    gpa: "4.50",
    examName: { bn: "অর্ধবার্ষিক পরীক্ষা", en: "Half-yearly exam" },
    meritPosition: 6,
  },
];

export const NOTICES: Notice[] = [
  {
    id: "n1",
    title: { bn: "অভিভাবক সভা — শনিবার সকাল ১০টা", en: "Guardian meeting — Saturday 10 AM" },
    body: {
      bn: "সকল অভিভাবককে শনিবার সকাল ১০টায় বিদ্যালয় মিলনায়তনে উপস্থিত থাকার জন্য অনুরোধ করা হলো।",
      en: "All guardians are requested to attend at the school auditorium on Saturday at 10 AM.",
    },
    ageDays: 4,
    isNew: true,
  },
  {
    id: "n2",
    title: { bn: "গ্রীষ্মকালীন ছুটি ঘোষণা", en: "Summer vacation announced" },
    body: {
      bn: "আগামী ২০ জুন থেকে ৩০ জুন পর্যন্ত বিদ্যালয় বন্ধ থাকবে।",
      en: "The school will remain closed from 20 to 30 June.",
    },
    ageDays: 9,
    isNew: false,
  },
];

export function getGuardianName() {
  return { bn: "আব্দুল করিম", en: "Abdul Karim" };
}
