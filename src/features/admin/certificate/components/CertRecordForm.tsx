"use client";

import { useState } from "react";
import { Search, FileText, Award } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { createClient } from "@/shared/services/supabase/client";
import { findStudentByCode, type StudentLite } from "@/shared/services/roster/api";
import { Field, Input, Select, Textarea, Button, EmptyState, useToast } from "@/shared/ui";
import { useCreateTestimonial, useCreateTransfer, useTestimonials, useTransfers } from "../logic/hooks";

/** Certificate record creator (testimonial | transfer) — live via fn_create_*. */
export function CertRecordForm({ kind }: { kind: "testimonial" | "transfer" }) {
  const isT = kind === "testimonial";
  const { t, n, isBn } = useT();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [student, setStudent] = useState<StudentLite | null>(null);
  const [f, setF] = useState<Record<string, string>>({ language: "bn" });
  const up = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const createT = useCreateTestimonial();
  const createTr = useCreateTransfer();
  const testimonials = useTestimonials();
  const transfers = useTransfers();
  const pending = createT.isPending || createTr.isPending;
  const list = isT ? testimonials.data ?? [] : transfers.data ?? [];

  async function lookup() {
    if (!code.trim()) return;
    try {
      const st = await findStudentByCode(createClient(), code.trim());
      if (!st) { toast({ title: t("শিক্ষার্থী পাওয়া যায়নি", "Student not found"), variant: "error" }); return; }
      setStudent(st);
    } catch (e) { toast({ title: e instanceof Error ? e.message : "Error", variant: "error" }); }
  }

  function generate() {
    if (!student) { toast({ title: t("শিক্ষার্থী নির্বাচন করুন", "Select a student"), variant: "error" }); return; }
    const base = { student_id: student.id, ...f };
    const onDone = () => { toast({ title: t("সনদ তৈরি হয়েছে", "Certificate created"), variant: "success" }); setF({ language: "bn" }); setStudent(null); setCode(""); };
    const onErr = (e: unknown) => toast({ title: e instanceof Error ? e.message : t("তৈরি ব্যর্থ", "Failed"), variant: "error" });
    if (isT) createT.mutate(base, { onSuccess: onDone, onError: onErr });
    else createTr.mutate(base, { onSuccess: onDone, onError: onErr });
  }

  const title = isT ? t("প্রশংসাপত্র", "Testimonial") : t("স্থানান্তর সনদ", "Transfer Certificate");

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <div className="flex items-center gap-1.5 text-[13px] text-text-muted"><span>{t("সার্টিফিকেট", "Certificate")}</span><span>›</span><span className="text-text-secondary">{title}</span></div>
        <h1 className="mt-1.5 text-[22px] font-bold text-text-primary">{title}</h1>
        <p className="mt-1 text-[13px] text-text-muted">{t("শিক্ষার্থী খুঁজে সনদের তথ্য দিন ও তৈরি করুন", "Look up a student, fill the details and generate")}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e3">
        <Field label={t("শিক্ষার্থী আইডি", "Student ID")} required className="w-60 max-w-full">
          <Input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookup()} placeholder="STU-0001" className="font-latin" />
        </Field>
        <Button variant="primary" className="h-10.5" onClick={lookup}><Search size={16} /> {t("অনুসন্ধান", "Search")}</Button>
        {student ? <span className="pb-2.5 text-[13px] font-semibold text-primary">{isBn ? student.name_bn : student.name_en} · {student.code ? n(student.code) : ""}</span> : null}
      </div>

      {!student ? (
        <EmptyState icon={<Award size={22} />} title={t("একজন শিক্ষার্থী খুঁজুন", "Look up a student")} />
      ) : (
        <div className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-e3">
          <h2 className="text-base font-semibold text-text-primary">{t("সনদের তথ্য", "Certificate details")}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t("সেশন", "Session")}><Input value={f.session ?? ""} onChange={(e) => up("session", e.target.value)} placeholder={n("২০২৬")} /></Field>
            <Field label={t("সনদ নম্বর", "Certificate no.")}><Input value={f.cert_no ?? ""} onChange={(e) => up("cert_no", e.target.value)} className="font-latin" placeholder={isT ? "TM-2026-0001" : "TC-2026-0001"} /></Field>
            <Field label={t("পিতা/মাতার নাম", "Parent name")}><Input value={f.parent_name ?? ""} onChange={(e) => up("parent_name", e.target.value)} /></Field>
            {isT ? (
              <Field label={t("আচরণ", "Conduct")}><Input value={f.conduct ?? ""} onChange={(e) => up("conduct", e.target.value)} placeholder={t("অত্যন্ত ভালো", "Very good")} /></Field>
            ) : (
              <>
                <Field label={t("ইস্যু তারিখ", "Issue date")}><Input type="date" value={f.issue_date ?? ""} onChange={(e) => up("issue_date", e.target.value)} /></Field>
                <Field label={t("সনদের ধরন", "Cert type")}><Input value={f.cert_type ?? ""} onChange={(e) => up("cert_type", e.target.value)} placeholder={t("স্থানান্তর / চরিত্র", "Transfer / Character")} /></Field>
              </>
            )}
            <Field label={t("ভাষা", "Language")}><Select value={f.language ?? "bn"} onChange={(e) => up("language", e.target.value)} options={[{ value: "bn", label: t("বাংলা", "Bangla") }, { value: "en", label: "English" }]} /></Field>
            <Field label={t("স্থায়ী ঠিকানা", "Permanent address")} className="sm:col-span-2 lg:col-span-3"><Input value={f.permanent_address ?? ""} onChange={(e) => up("permanent_address", e.target.value)} /></Field>
            <Field label={isT ? t("বিশেষ মন্তব্য", "Remarks") : t("কারণ", "Reason")} className="sm:col-span-2 lg:col-span-3">
              <Textarea value={f[isT ? "remarks" : "reason"] ?? ""} onChange={(e) => up(isT ? "remarks" : "reason", e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end gap-3">
            <button disabled className="rounded-lg border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-text-muted opacity-60">{t("PDF (শীঘ্রই)", "PDF (soon)")}</button>
            <Button variant="primary" onClick={generate} disabled={pending}>{pending ? t("তৈরি হচ্ছে…", "Creating…") : t("তৈরি করুন", "Generate")}</Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-surface shadow-e3">
        <div className="border-b border-border-default px-5 py-4"><p className="text-base font-semibold text-text-primary">{t("সাম্প্রতিক সনদ", "Recent certificates")}</p></div>
        {list.length === 0 ? (
          <div className="p-5"><EmptyState icon={<FileText size={22} />} title={t("এখনও কোনো সনদ নেই", "No certificates yet")} /></div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-5 pt-4 pb-2 text-[12.5px] font-semibold text-text-muted">
              <div className="flex-1">{t("শিক্ষার্থী", "Student")}</div>
              <div className="w-40">{t("সনদ নম্বর", "Cert no.")}</div>
              <div className="w-24">{t("সেশন", "Session")}</div>
            </div>
            {list.map((r, i) => (
              <div key={r.id} className={cn("flex items-center gap-3 px-5 py-3", i % 2 === 1 && "bg-sunken")}>
                <div className="flex-1 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
                <div className="w-40 font-latin text-[13px] text-text-secondary">{r.cert_no ?? "—"}</div>
                <div className="w-24 text-[13px] text-text-secondary tnum">{r.session ? n(r.session) : "—"}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
