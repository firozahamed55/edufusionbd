"use client";

import { useMemo, useState } from "react";
import { Search, Pencil, Users } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { GENDER, RELIGION, BLOOD_GROUP, BLOOD_TOKEN, BLOOD_LABEL } from "@/shared/constants/enums";
import {
  Button, Field, Select, Input, Skeleton, EmptyState, ErrorState, Modal, useToast, } from "@/shared/ui";
import { useClassSectionsLookup, useStudentCategories } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useSectionStudents, useStudentBasic, useUpdateStudentBasic } from "../../logic/hooks";
import type { StudentBasicPayload } from "../../logic/api";
import { useErrorMessage } from "@/shared/services/errors";

/**
 * Student · Update Basic Info — live section list → edit modal.
 * Section filter → students from Supabase (RLS-scoped) → edit basic fields via
 * fn_update_student_basic. Loading / empty / error states are all real.
 */

export function UpdateBasicScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const [sectionId, setSectionId] = useState<string>("");
  const [query, setQuery] = useState({ id: "", roll: "", name: "" });
  const [editId, setEditId] = useState<string | null>(null);

  const sections = useClassSectionsLookup();
  const students = useSectionStudents(sectionId || null);

  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));

  const rows = useMemo(() => {
    const all = students.data ?? [];
    return all.filter((r) =>
      (!query.id || (r.code ?? "").toLowerCase().includes(query.id.toLowerCase())) &&
      (!query.roll || String(r.roll ?? "").includes(query.roll)) &&
      (!query.name || `${r.name_bn} ${r.name_en}`.toLowerCase().includes(query.name.toLowerCase())),
    );
  }, [students.data, query]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="mt-1.5 text-h4 font-bold text-text-primary">{t("মৌলিক তথ্য হালনাগাদ", "Update Basic Info")}</h1>
        <p className="mt-1 text-meta text-text-muted">{t("নির্বাচিত শিক্ষার্থীর মৌলিক তথ্য সম্পাদনা করুন", "Edit basic information of the selected student")}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e1">
        <Field label={t("শ্রেণি ও শাখা", "Class & Section")} required className="w-90 max-w-full">
          <Select
            value={sectionId}
            placeholder={sections.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন করুন", "Select")}
            options={opt(sections.data)}
            onChange={(e) => setSectionId(e.target.value)}
          />
        </Field>
        <Button variant="primary" className="h-10.5 px-6" disabled>
          <Search size={16} /> {t("অনুসন্ধান", "Search")}
        </Button>
      </div>

      {!sectionId ? (
        <EmptyState icon={<Users size={22} />} title={t("একটি শ্রেণি ও শাখা নির্বাচন করুন", "Select a class & section")} description={t("শিক্ষার্থী তালিকা দেখতে উপরে থেকে শ্রেণি বেছে নিন।", "Pick a section above to load its student list.")} />
      ) : students.isLoading ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-5 shadow-e1">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}
        </div>
      ) : students.isError ? (
        <ErrorState title={t("তালিকা লোড করা যায়নি", "Could not load list")} description={msg(students.error)} />
      ) : (students.data ?? []).length === 0 ? (
        <EmptyState icon={<Users size={22} />} title={t("এই শাখায় কোনো শিক্ষার্থী নেই", "No students in this section")} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border-default bg-surface shadow-e1">
          <div className="flex items-center gap-3 border-b border-border-default px-5 py-4">
            <p className="flex-1 text-base font-semibold text-text-primary">{t("শিক্ষার্থী তালিকা", "Student List")}</p>
            <span className="text-meta font-semibold text-primary">{t("মোট পাওয়া গেছে", "Total found")}: {n(rows.length)}</span>
          </div>
          <div className="flex items-center gap-3 px-5 pt-4 text-meta font-semibold text-text-muted">
            <div className="w-37.5">{t("শিক্ষার্থী আইডি", "Student ID")}</div>
            <div className="w-20">{t("রোল", "Roll")}</div>
            <div className="flex-1">{t("নাম", "Name")}</div>
            <div className="w-37.5">{t("ক্যাটাগরি", "Category")}</div>
            <div className="w-20 text-right">{t("অ্যাকশন", "Action")}</div>
          </div>
          <div className="flex items-center gap-3 border-b border-border-default px-5 pb-3 pt-2">
            <ColFilter className="w-37.5" placeholder={t("আইডি", "ID")} value={query.id} onChange={(v) => setQuery((q) => ({ ...q, id: v }))} />
            <ColFilter className="w-20" placeholder={t("রোল", "Roll")} value={query.roll} onChange={(v) => setQuery((q) => ({ ...q, roll: v }))} />
            <ColFilter className="flex-1" placeholder={t("নাম খুঁজুন", "Search name")} value={query.name} onChange={(v) => setQuery((q) => ({ ...q, name: v }))} />
            <div className="w-37.5" />
            <div className="w-20" />
          </div>
          {rows.map((r, i) => (
            <div key={r.enrollmentId} className={cn("flex items-center gap-3 px-5 py-3.5", i % 2 === 1 && "bg-sunken")}>
              <div className="w-37.5 font-latin text-meta font-medium text-text-secondary tnum">{r.code ? n(r.code) : "—"}</div>
              <div className="w-20 text-meta text-text-secondary tnum">{r.roll != null ? n(r.roll) : "—"}</div>
              <div className="flex-1 text-sm font-medium text-text-primary">{isBn ? r.name_bn : r.name_en}</div>
              <div className="w-37.5">
                <span className="inline-block rounded-full bg-primary-subtle px-2.5 py-1 text-xs font-semibold text-primary">{r.category ?? t("সাধারণ", "General")}</span>
              </div>
              <div className="flex w-20 justify-end">
                <button aria-label={t("সম্পাদনা", "Edit")} onClick={() => setEditId(r.studentId)}
                  className="grid size-8 place-items-center rounded-lg bg-primary text-text-on-primary hover:bg-primary-hover">
                  <Pencil size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editId ? <EditModal studentId={editId} onClose={() => setEditId(null)} /> : null}
    </div>
  );
}

function ColFilter({ className, placeholder, value, onChange }: { className?: string; placeholder?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className={className}>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="h-8 w-full rounded-md border border-border-strong bg-surface px-2 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none" />
    </div>
  );
}

function EditModal({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { t, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const detail = useStudentBasic(studentId);
  const categories = useStudentCategories();
  const update = useUpdateStudentBasic();
  const [f, setF] = useState<Record<string, string> | null>(null);

  const values = f ?? (detail.data
    ? { ...detail.data, blood_group: detail.data.blood_group ? BLOOD_LABEL[detail.data.blood_group] ?? "" : "" }
    : null);
  const up = (k: string, v: string) => setF((p) => ({ ...(p ?? (values as Record<string, string>)), [k]: v }));

  function save() {
    if (!values) return;
    if (!values.name_bn || !values.name_en) {
      toast({ title: t("নাম আবশ্যক", "Name is required"), variant: "error" });
      return;
    }
    const payload: StudentBasicPayload = {
      id: studentId,
      name_bn: values.name_bn,
      name_en: values.name_en,
      dob: values.dob,
      gender: values.gender,
      blood_group: values.blood_group ? BLOOD_TOKEN[values.blood_group] ?? "" : "",
      religion: values.religion,
      birth_reg_no: values.birth_reg_no,
      nationality: values.nationality,
      student_category_id: values.student_category_id,
    };
    update.mutate(payload, {
      onSuccess: () => { toast({ title: t("তথ্য হালনাগাদ হয়েছে", "Info updated"), variant: "success" }); onClose(); },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
    });
  }

  return (
    <Modal open onClose={onClose} title={t("মৌলিক তথ্য সম্পাদনা", "Edit Basic Info")}
      description={detail.data?.student_code ?? undefined} className="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>{t("বাতিল", "Cancel")}</Button>
          <Button variant="primary" onClick={save} disabled={update.isPending || !values}>
            {update.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}
          </Button>
        </>
      }>
      {detail.isLoading || !values ? (
        <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("নাম (বাংলা)", "Name (Bangla)")} required><Input value={values.name_bn} onChange={(e) => up("name_bn", e.target.value)} /></Field>
            <Field label={t("Name (English)", "Name (English)")} required><Input value={values.name_en} onChange={(e) => up("name_en", e.target.value)} className="font-latin" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("জন্ম তারিখ", "Date of Birth")}><Input type="date" value={values.dob} onChange={(e) => up("dob", e.target.value)} /></Field>
            <Field label={t("লিঙ্গ", "Gender")}>
              <Select value={values.gender} onChange={(e) => up("gender", e.target.value)} options={GENDER.map((g) => ({ value: g.value, label: isBn ? g.bn : g.en }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("রক্তের গ্রুপ", "Blood Group")}>
              <Select value={values.blood_group} onChange={(e) => up("blood_group", e.target.value)} placeholder={t("নির্বাচন", "Select")} options={BLOOD_GROUP.map((b) => ({ value: b, label: b }))} />
            </Field>
            <Field label={t("ধর্ম", "Religion")}>
              <Select value={values.religion} onChange={(e) => up("religion", e.target.value)} placeholder={t("নির্বাচন", "Select")} options={RELIGION.map((r) => ({ value: r.value, label: isBn ? r.bn : r.en }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("জন্ম নিবন্ধন", "Birth Reg.")}><Input value={values.birth_reg_no} onChange={(e) => up("birth_reg_no", e.target.value)} className="font-latin" /></Field>
            <Field label={t("ক্যাটাগরি", "Category")}>
              <Select value={values.student_category_id} onChange={(e) => up("student_category_id", e.target.value)} placeholder={t("নির্বাচন", "Select")}
                options={(categories.data ?? []).map((c) => ({ value: c.value, label: isBn ? c.label_bn : c.label_en }))} />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
