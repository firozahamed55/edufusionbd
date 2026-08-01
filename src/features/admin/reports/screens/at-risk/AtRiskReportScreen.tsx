"use client";

import Link from "next/link";
import { CalendarX, Download, LifeBuoy, Phone, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import {
  Skeleton, ErrorState, Button, Badge,
  Table, THead, TBody, TR, TH, TD, TableEmpty,
} from "@/shared/ui";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay } from "@/shared/lib/format";
import { useErrorMessage } from "@/shared/services/errors";
import { ReportShell } from "../../components/ReportShell";
import { useAtRiskReport } from "../../logic/hooks";
import { atRiskFindings } from "../../logic/insights";
import { RISK, type AtRiskStudent, type RiskSignal } from "../../logic/api";

/**
 * The at-risk register (analysis II · R-4).
 *
 * "The report that makes the module worth opening." Bangladeshi secondary
 * schools lose students to dropout, and the three signals that precede it are
 * already in this database — attendance below 75%, marks falling term-on-term,
 * fees unpaid past 90 days. No single module can see all three: attendance
 * lives in one screen, arrears in another, results in a third. Joining them
 * produces a ranked list of children to intervene on, and it needed no schema
 * change to build.
 *
 * WHY THE GUARDIAN'S NUMBER IS A COLUMN. The output of this report is a
 * sequence of phone calls. A register that names the child and then requires
 * the reader to open each profile to find a number is a list, not a worklist —
 * and the students most likely to be on it are also the ones most likely to
 * have no number on file, which is itself something the reader needs to see.
 */

const SIGNAL_META: Record<RiskSignal, { icon: typeof CalendarX; bn: string; en: string }> = {
  attendance: { icon: CalendarX, bn: "উপস্থিতি", en: "Attendance" },
  arrears: { icon: Wallet, bn: "বকেয়া", en: "Arrears" },
  marks: { icon: TrendingDown, bn: "ফলাফল", en: "Marks" },
};

export function AtRiskReportScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const report = useAtRiskReport();
  const d = report.data;

  const students = d?.students ?? [];
  const multiSignal = students.filter((s) => s.signals.length > 1).length;
  const findings = d
    ? atRiskFindings({
        totalStudents: d.totalStudents,
        atRisk: students.length,
        multiSignal,
        arrears: students.map((s) => s.arrears),
        allSignalsAvailable: d.attendanceCoverage.assessable > 0 && d.comparedExams !== null,
      })
    : [];

  const bdt = (v: number) => `৳${n(new Intl.NumberFormat("en-IN").format(Math.round(v)))}`;

  return (
    <ReportShell
      title={t("ঝুঁকিতে থাকা শিক্ষার্থী", "At-risk Register")}
      subtitle={t(
        "ঝরে পড়ার আগে যে তিনটি লক্ষণ দেখা যায় — এক তালিকায়",
        "The three signals that precede a dropout, joined into one list",
      )}
      findings={findings}
      provenance={{
        filters: [
          { label: t("শিক্ষাবর্ষ", "Academic year"), value: t("চলমান", "Current") },
          { label: t("ভর্তি", "Enrolment"), value: t("সক্রিয়", "Active") },
        ],
        definitions: [
          {
            term: t("উপস্থিতি সংকেত", "Attendance signal"),
            meaning: t(
              `বছরের উপস্থিতি ${n(RISK.ATTENDANCE_FLOOR)}% এর নিচে, অন্তত ${n(RISK.MIN_ATTENDANCE_DAYS)} দিনের রেকর্ড থাকলে — ${n(RISK.ATTENDANCE_FLOOR)}% পরীক্ষায় বসার যোগ্যতার সীমাও`,
              `Attendance below ${RISK.ATTENDANCE_FLOOR}% over at least ${RISK.MIN_ATTENDANCE_DAYS} recorded days — ${RISK.ATTENDANCE_FLOOR}% is also the floor that gates exam eligibility`,
            ),
          },
          {
            term: t("বকেয়া সংকেত", "Arrears signal"),
            meaning: t(
              `শেষ তারিখের ${n(RISK.ARREARS_DAYS)} দিনের বেশি পার হওয়া অপরিশোধিত ফি`,
              `Fees still unpaid more than ${RISK.ARREARS_DAYS} days after their due date`,
            ),
          },
          {
            term: t("ফলাফল সংকেত", "Marks signal"),
            meaning: d?.comparedExams
              ? t(
                  `${d.comparedExams.previous} থেকে ${d.comparedExams.current} এ জিপিএ ${n(RISK.GPA_DROP)} বা তার বেশি কমেছে`,
                  `GPA fell by ${RISK.GPA_DROP} or more from ${d.comparedExams.previous} to ${d.comparedExams.current}`,
                )
              : t(
                  "তুলনা করার মতো দুটি প্রক্রিয়াকৃত পরীক্ষা নেই — এই সংকেত এখন নিষ্ক্রিয়",
                  "There are not two processed exams to compare, so this signal is inactive",
                ),
          },
        ],
        fetchedAt: report.dataUpdatedAt || undefined,
      }}
      actions={
        <Button
          onClick={() => d && exportCsv(
            `at-risk-register-${localDay()}.csv`,
            students.map((s) => ({
              StudentId: s.code ?? "",
              Name: s.name_en,
              NameBn: s.name_bn,
              Section: s.section_en,
              GuardianMobile: s.guardianMobile ?? "",
              Signals: s.signals.join(" + "),
              AttendancePct: s.attendanceRate ?? "",
              Arrears: s.arrears,
              ArrearsDays: s.arrearsDays,
              GpaChange: s.gpaDelta ?? "",
            })),
            // A roster carrying guardian mobile numbers for the most vulnerable
            // students in the school is exactly the export R-7 exists for.
            { kind: "reports.at_risk", params: { students: students.length, multiSignal } },
          )}
          disabled={students.length === 0}
        >
          <Download size={16} /> {t("এক্সপোর্ট", "Export")}
        </Button>
      }
    >
      {report.isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : report.isError ? (
        <ErrorState title={t("রিপোর্ট লোড করা যায়নি", "Could not load report")} description={msg(report.error)} />
      ) : !d ? null : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label={t("ঝুঁকিতে", "At risk")} value={n(students.length)} sub={t(`${n(d.totalStudents)} জনের মধ্যে`, `of ${d.totalStudents}`)} grad="grad-amber" />
            <Kpi label={t("একাধিক সংকেত", "Multiple signals")} value={n(multiSignal)} sub={t("অগ্রাধিকার", "Highest priority")} grad="grad-indigo" />
            <Kpi
              label={t("উপস্থিতি কম", "Low attendance")}
              value={d.attendanceCoverage.assessable === 0 ? "—" : n(students.filter((s) => s.signals.includes("attendance")).length)}
              sub={
                d.attendanceCoverage.assessable === 0
                  ? t("যথেষ্ট হাজিরা নেই", "Not enough registers")
                  : t(`${n(RISK.ATTENDANCE_FLOOR)}% এর নিচে`, `below ${RISK.ATTENDANCE_FLOOR}%`)
              }
              grad="grad-sky"
            />
            <Kpi
              label={t("দীর্ঘ বকেয়া", "Long arrears")}
              value={n(students.filter((s) => s.signals.includes("arrears")).length)}
              sub={t(`${n(RISK.ARREARS_DAYS)}+ দিন`, `${RISK.ARREARS_DAYS}+ days`)}
              grad="grad-emerald"
            />
          </div>

          <section className="flex flex-col gap-3">
            <div>
              <p className="text-base font-semibold text-text-primary">{t("হস্তক্ষেপের তালিকা", "Intervention list")}</p>
              <p className="mt-0.5 text-meta text-text-muted">
                {t(
                  "সংকেতের সংখ্যা অনুযায়ী সাজানো — সবচেয়ে বেশি সংকেত যার, সে আগে",
                  "Ranked by number of signals — the child showing the most comes first",
                )}
              </p>
            </div>
            <Table minWidth={900}>
              <THead>
                <TR>
                  <TH>{t("শিক্ষার্থী", "Student")}</TH>
                  <TH className="w-40">{t("শাখা", "Section")}</TH>
                  <TH className="w-52">{t("সংকেত", "Signals")}</TH>
                  <TH className="w-24 text-right">{t("উপস্থিতি", "Attendance")}</TH>
                  <TH className="w-32 text-right">{t("বকেয়া", "Arrears")}</TH>
                  <TH className="w-24 text-right">{t("জিপিএ পরিবর্তন", "GPA change")}</TH>
                  <TH className="w-36">{t("অভিভাবক", "Guardian")}</TH>
                </TR>
              </THead>
              <TBody>
                {students.length === 0 ? (
                  <TableEmpty
                    colSpan={7}
                    icon={<LifeBuoy size={22} />}
                    title={t("কোনো শিক্ষার্থী ঝুঁকির সীমা অতিক্রম করেনি", "No student crosses a risk threshold")}
                  />
                ) : (
                  students.map((s) => <Row key={s.studentId} s={s} isBn={isBn} n={n} t={t} bdt={bdt} />)
                )}
              </TBody>
            </Table>
          </section>

          {/*
            A SIGNAL THAT CANNOT BE COMPUTED MUST SAY SO. "No child's marks are
            falling" and "we cannot yet tell" are opposite facts that look
            identical on a screen which simply renders a shorter list, and only
            one of them is good news. This school is in the second state on both
            counts — one register taken, one exam — so a silent report here
            would be actively reassuring about something nobody has checked.
          */}
          {d.attendanceCoverage.assessable === 0 || !d.comparedExams ? (
            <div className="flex flex-col gap-1.5 rounded-xl border border-border-default bg-sunken px-4 py-3 text-meta text-text-muted">
              <p className="font-medium text-text-secondary">
                {t("যে সংকেতগুলো এখন গণনা করা যাচ্ছে না", "Signals that cannot be computed yet")}
              </p>
              {d.attendanceCoverage.assessable === 0 ? (
                <p>
                  {t(
                    `উপস্থিতি — কোনো শিক্ষার্থীর ${n(RISK.MIN_ATTENDANCE_DAYS)} দিনের হাজিরা রেকর্ড নেই (সর্বোচ্চ ${n(d.attendanceCoverage.maxDays)} দিন)। এই তালিকা "উপস্থিতি ভালো" বলছে না, বলছে এখনো যথেষ্ট হাজিরা নেওয়া হয়নি।`,
                    `Attendance — no student yet has ${RISK.MIN_ATTENDANCE_DAYS} recorded days (the most any has is ${d.attendanceCoverage.maxDays}). This list is not saying attendance is fine; it is saying not enough registers have been taken to tell.`,
                  )}
                </p>
              ) : null}
              {!d.comparedExams ? (
                <p>
                  {t(
                    "ফলাফল — তুলনার জন্য দুটি প্রক্রিয়াকৃত পরীক্ষা প্রয়োজন।",
                    "Marks — this needs two processed exams to compare.",
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </ReportShell>
  );
}

function Row({
  s, isBn, n, t, bdt,
}: {
  s: AtRiskStudent;
  isBn: boolean;
  n: (v: string | number) => string;
  t: (bn: string, en: string) => string;
  bdt: (v: number) => string;
}) {
  return (
    <TR>
      <TH scope="row" className="text-left">
        <Link
          href={`/admin/student/update-basic?id=${s.studentId}`}
          className="text-sm font-semibold text-text-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          {isBn ? s.name_bn : s.name_en}
        </Link>
        <span className="block text-micro text-text-muted tnum">{s.code ? n(s.code) : "—"}</span>
      </TH>
      <TD className="text-meta text-text-secondary">{isBn ? s.section_bn : s.section_en}</TD>
      <TD>
        <div className="flex flex-wrap gap-1.5">
          {s.signals.map((sig) => {
            const meta = SIGNAL_META[sig];
            const Icon = meta.icon;
            return (
              <Badge key={sig} tone={s.signals.length > 1 ? "danger" : "warning"}>
                <Icon size={11} className="mr-1 inline" />
                {isBn ? meta.bn : meta.en}
              </Badge>
            );
          })}
        </div>
      </TD>
      <TD className={cn("text-right text-meta tnum", s.signals.includes("attendance") ? "font-semibold text-danger-fg" : "text-text-secondary")}>
        {s.attendanceRate !== null ? `${n(s.attendanceRate)}%` : "—"}
      </TD>
      <TD className={cn("text-right text-meta tnum", s.arrears > 0 ? "font-semibold text-text-primary" : "text-text-muted")}>
        {s.arrears > 0 ? (
          <>
            {bdt(s.arrears)}
            <span className="block text-micro font-normal text-text-muted">
              {t(`${n(s.arrearsDays)} দিন`, `${s.arrearsDays} days`)}
            </span>
          </>
        ) : (
          "—"
        )}
      </TD>
      <TD className={cn("text-right text-meta tnum", s.gpaDelta !== null && s.gpaDelta < 0 ? "font-semibold text-danger-fg" : "text-text-secondary")}>
        {s.gpaDelta !== null ? `${s.gpaDelta > 0 ? "+" : "−"}${n(Math.abs(s.gpaDelta).toFixed(2))}` : "—"}
      </TD>
      <TD>
        {/*
          A number that is there is a `tel:` link, because the action this
          report produces is a phone call. A number that is NOT there is called
          out rather than left blank — an unreachable guardian is the reason an
          intervention does not happen, and it is fixable.
        */}
        {s.guardianMobile ? (
          <a
            href={`tel:${s.guardianMobile}`}
            className="inline-flex items-center gap-1.5 text-meta font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <Phone size={12} />
            <span className="tnum">{n(s.guardianMobile)}</span>
          </a>
        ) : (
          <span className="text-meta text-danger-fg">{t("নম্বর নেই", "No number")}</span>
        )}
      </TD>
    </TR>
  );
}

function Kpi({ label, value, sub, grad }: { label: string; value: string; sub?: string; grad: string }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl px-5 py-4.5 text-white shadow-e2", grad)}>
      <p className="text-meta font-medium opacity-90">{label}</p>
      <p className="text-3xl font-bold tnum">{value}</p>
      <p className="text-meta opacity-90">{sub ?? " "}</p>
    </div>
  );
}
