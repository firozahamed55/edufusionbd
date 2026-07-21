"use client";

import { useT } from "@/shared/i18n/useT";
import { Badge } from "@/shared/ui";
import { Card, CardHead } from "@/features/parent/components";
import { useActiveChild } from "@/features/parent/state";

type Subject = { bn: string; en: string; marks: number; grade: string };

const SUBJECTS: Subject[] = [
  { bn: "বাংলা", en: "Bangla", marks: 82, grade: "A+" },
  { bn: "ইংরেজি", en: "English", marks: 78, grade: "A" },
  { bn: "গণিত", en: "Mathematics", marks: 91, grade: "A+" },
  { bn: "বিজ্ঞান", en: "Science", marks: 85, grade: "A+" },
  { bn: "সমাজ", en: "Social Science", marks: 74, grade: "A" },
  { bn: "ধর্ম", en: "Religion", marks: 88, grade: "A+" },
];

export default function ParentResults() {
  const { t, n } = useT();
  const { active } = useActiveChild();

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="text-lg font-bold">{t("ফলাফল ও মার্কশিট", "Results & marksheet")}</h1>

      <Card>
        <div className="grad-indigo -m-4 mb-3 rounded-t-2xl p-4 text-white">
          <p className="text-meta text-white/75">{t(active.examName.bn, active.examName.en)}</p>
          <div className="mt-1 flex items-end justify-between">
            <p className="text-3xl font-black tnum">GPA {n(active.gpa)}</p>
            <Badge tone="success" dot>{t("প্রকাশিত", "Published")}</Badge>
          </div>
          <p className="mt-1 text-meta text-white/75">
            {t("মেধাক্রম", "Merit position")}: {n(active.meritPosition)}
          </p>
        </div>

        <CardHead title={t("বিষয়ভিত্তিক নম্বর", "Subject-wise marks")} />
        <ul className="flex flex-col divide-y divide-border-default">
          {SUBJECTS.map((s) => (
            <li key={s.en} className="flex items-center justify-between py-2.5">
              <span className="text-sm font-medium text-text-primary">{t(s.bn, s.en)}</span>
              <span className="flex items-center gap-3">
                <span className="text-sm tabular-nums text-text-secondary tnum">{n(s.marks)}</span>
                <Badge tone={s.grade === "A+" ? "success" : "info"}>{s.grade}</Badge>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <button
        type="button"
        className="rounded-xl border border-border-strong bg-surface py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-sunken"
      >
        {t("মার্কশিট ডাউনলোড (PDF)", "Download marksheet (PDF)")}
      </button>
    </div>
  );
}
