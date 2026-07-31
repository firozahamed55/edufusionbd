"use client";

import Link from "next/link";
import { CalendarCheck, History, Pencil, Receipt, User, Wallet } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Skeleton, EmptyState, ErrorState, PageHeader, Badge, buttonClass,
  Table, THead, TBody, TR, TH, TD, TableEmpty,
} from "@/shared/ui";
import { useQueryState } from "@/shared/lib/useQueryState";
import { formatDate } from "@/shared/lib/format";
import { GENDER, RELIGION, BLOOD_LABEL } from "@/shared/constants/enums";
import { useErrorMessage } from "@/shared/services/errors";
import { useStudentBasic } from "../../logic/hooks";
// A profile page aggregates a person across modules by definition — identity
// here, money in `fee`, presence in `attendance`. Re-declaring the fee reads
// inside `student` would give the institution two queries that must agree
// about what a student owes, which is the class of bug this module has already
// been bitten by once.
import { useStudentProfile, useStudentInvoices } from "../../../fee/logic/hooks";

/**
 * Student · Profile (SRA §6 IA gap — "every stored entity has a detail page").
 *
 * A registrar's most frequent intent is "pull up student 2026-0417", and until
 * now the product had no answer: a student existed as a row in six lists and
 * as an edit modal, never as a page you could open, link to, or hand to a
 * colleague. Every roster in the product now links here.
 *
 * Read-only, and it links out rather than duplicating: edit goes to Update
 * Info, attendance to the Report filtered on nothing yet, money to the invoice
 * table below, and history to the Audit Log filtered to this exact record —
 * the per-record change timeline A-2.2 says nothing surfaces.
 */
export function StudentProfileScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();

  const [{ id }] = useQueryState({ id: "" });
  const basic = useStudentBasic(id || null);
  const profile = useStudentProfile(id || null);
  const invoices = useStudentInvoices(id || null);

  if (!id) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          crumbs={[{ label: t("শিক্ষার্থী", "Students"), href: "/admin/student/update-class" }, { label: t("প্রোফাইল", "Profile") }]}
          title={t("শিক্ষার্থী প্রোফাইল", "Student Profile")}
        />
        <EmptyState
          icon={<User size={22} />}
          title={t("কোনো শিক্ষার্থী নির্বাচিত নয়", "No student selected")}
          description={t("যেকোনো তালিকা থেকে একজন শিক্ষার্থীর নামে ক্লিক করুন।", "Open a student from any roster in the product.")}
        />
      </div>
    );
  }

  const isLoading = basic.isLoading || profile.isLoading;
  const error = basic.error ?? profile.error;
  const p = profile.data;
  const b = basic.data;
  const name = isBn ? b?.name_bn : b?.name_en;

  const label = (list: readonly { value: string; bn: string; en: string }[], v?: string) =>
    list.find((x) => x.value === v)?.[isBn ? "bn" : "en"] ?? (v || "—");

  const dues = invoices.data ?? [];
  const totalDue = dues.reduce((s, r) => s + r.due, 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={[
          { label: t("শিক্ষার্থী", "Students"), href: "/admin/student/update-class" },
          { label: name || t("প্রোফাইল", "Profile") },
        ]}
        title={name || t("শিক্ষার্থী প্রোফাইল", "Student Profile")}
        subtitle={p ? `${p.section}${p.roll != null ? ` · ${t("রোল", "Roll")} ${n(p.roll)}` : ""}` : undefined}
      />

      {error ? (
        <ErrorState title={t("প্রোফাইল লোড করা যায়নি", "Could not load the profile")} description={msg(error)} />
      ) : isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : !b || !p ? (
        <EmptyState icon={<User size={22} />} title={t("শিক্ষার্থী পাওয়া যায়নি", "Student not found")} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/student/update-basic?id=${id}`} className={buttonClass("primary")}>
              <Pencil size={16} /> {t("তথ্য সম্পাদনা", "Edit info")}
            </Link>
            <Link href="/admin/attendance/report" className={buttonClass("secondary")}>
              <CalendarCheck size={16} /> {t("উপস্থিতি রিপোর্ট", "Attendance report")}
            </Link>
            {/* The per-record change timeline. The Audit Log's search box takes
                a record id, which is exactly what this link supplies. */}
            <Link href={`/admin/core/audit-log?q=${id}`} className={buttonClass("secondary")}>
              <History size={16} /> {t("পরিবর্তনের ইতিহাস", "Change history")}
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title={t("পরিচয়", "Identity")}>
              <Row label={t("শিক্ষার্থী আইডি", "Student ID")} value={b.student_code ? n(b.student_code) : "—"} latin />
              <Row label={t("নাম (বাংলা)", "Name (Bangla)")} value={b.name_bn || "—"} />
              <Row label={t("Name (English)", "Name (English)")} value={b.name_en || "—"} latin />
              <Row label={t("জন্ম তারিখ", "Date of birth")} value={b.dob ? formatDate(b.dob) : "—"} />
              <Row label={t("লিঙ্গ", "Gender")} value={label(GENDER, b.gender)} />
              <Row label={t("ধর্ম", "Religion")} value={label(RELIGION, b.religion)} />
              <Row label={t("রক্তের গ্রুপ", "Blood group")} value={b.blood_group ? BLOOD_LABEL[b.blood_group] ?? b.blood_group : "—"} latin />
              <Row label={t("জন্ম নিবন্ধন", "Birth registration")} value={b.birth_reg_no || "—"} latin />
              <Row label={t("জাতীয়তা", "Nationality")} value={b.nationality || "—"} />
            </Card>

            <Card title={t("শ্রেণি ও অভিভাবক", "Class & guardian")}>
              <Row label={t("শ্রেণি ও শাখা", "Class & section")} value={p.section} />
              <Row label={t("রোল", "Roll")} value={p.roll != null ? n(p.roll) : "—"} />
              <Row label={t("ক্যাটাগরি", "Category")} value={p.category ?? t("সাধারণ", "General")} />
              <Row label={t("অভিভাবক", "Guardian")} value={p.father ?? "—"} />
              <Row label={t("মোবাইল", "Mobile")} value={p.mobile ?? "—"} latin />
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="flex flex-1 items-center gap-2 text-base font-semibold text-text-primary">
              <Wallet size={18} className="text-text-muted" /> {t("এই শিক্ষাবর্ষের ফি", "Fees this academic year")}
            </p>
            {totalDue > 0 ? (
              <Badge tone="danger">{t(`মোট বকেয়া ৳${n(totalDue)}`, `৳${n(totalDue)} due`)}</Badge>
            ) : dues.length > 0 ? (
              <Badge tone="success">{t("কোনো বকেয়া নেই", "Nothing outstanding")}</Badge>
            ) : null}
          </div>

          <Table minWidth={720}>
            <THead>
              <TR>
                <TH>{t("সময়কাল", "Period")}</TH>
                <TH>{t("ফি হেড", "Fee heads")}</TH>
                <TH className="w-24 text-right">{t("মোট", "Total")}</TH>
                <TH className="w-24 text-right">{t("পরিশোধ", "Paid")}</TH>
                <TH className="w-24 text-right">{t("বকেয়া", "Due")}</TH>
                <TH className="w-24 text-center">{t("স্ট্যাটাস", "Status")}</TH>
              </TR>
            </THead>
            <TBody>
              {invoices.isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TR key={i}>{Array.from({ length: 6 }).map((__, j) => <TD key={j}><Skeleton className="h-5" /></TD>)}</TR>
                ))
              ) : dues.length === 0 ? (
                <TableEmpty colSpan={6} icon={<Receipt size={22} />} title={t("এই বছরে কোনো ফি আরোপ হয়নি", "No fees applied this year")} />
              ) : (
                dues.map((r) => (
                  <TR key={r.id}>
                    <TD className="text-meta text-text-secondary">{r.period ?? "—"}</TD>
                    <TD className="text-meta text-text-secondary">{r.heads || "—"}</TD>
                    <TD className="text-right text-meta tnum">৳{n(r.total)}</TD>
                    <TD className="text-right text-meta tnum">৳{n(r.paid)}</TD>
                    <TD className="text-right text-sm font-bold text-text-primary tnum">৳{n(r.due)}</TD>
                    <TD className="text-center">
                      <Badge tone={r.due > 0 ? "warning" : "success"}>{r.status}</Badge>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface p-5 shadow-e1">
      <p className="mb-2 text-base font-semibold text-text-primary">{title}</p>
      <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-2.5">{children}</dl>
    </div>
  );
}

function Row({ label, value, latin }: { label: string; value: string; latin?: boolean }) {
  return (
    <>
      <dt className="text-meta text-text-muted">{label}</dt>
      <dd className={`text-meta font-medium text-text-primary${latin ? " font-latin" : ""}`}>{value}</dd>
    </>
  );
}
