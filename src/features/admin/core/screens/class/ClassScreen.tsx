"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, GraduationCap, Users } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import {
  FormCard, Field, Input, Select, Button, EmptyState, ConfirmDialog, useToast, PageHeader,
  Table, THead, TBody, TR, TH, TD, TableEmpty,
} from "@/shared/ui";
import {
  useClasses, useUpsertClass, useDeleteClass,
  useClassSections, useUpsertClassSection, useDeleteClassSection, useTeacherOptions,
} from "../../logic/hooks";
import { useErrorMessage } from "@/shared/services/errors";

const EMPTY_CLASS = { id: "", name_bn: "", name_en: "", numeric_level: "" };
const EMPTY_SECTION = { id: "", section_name: "", capacity: "", class_teacher_id: "" };

export function ClassScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const classes = useClasses();
  const teachers = useTeacherOptions();
  const upsertClass = useUpsertClass();
  const deleteClass = useDeleteClass();
  const upsertSection = useUpsertClassSection();
  const deleteSection = useDeleteClassSection();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cf, setCf] = useState({ ...EMPTY_CLASS });
  const [sf, setSf] = useState({ ...EMPTY_SECTION });
  const [delClassId, setDelClassId] = useState<string | null>(null);
  const [delSectionId, setDelSectionId] = useState<string | null>(null);

  const rows = classes.data ?? [];
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const sections = useClassSections(selectedId);

  useEffect(() => {
    if (!selectedId && classes.data && classes.data.length > 0) setSelectedId(classes.data[0].id);
  }, [classes.data, selectedId]);

  useEffect(() => {
    if (selected) setCf({ id: selected.id, name_bn: selected.name_bn, name_en: selected.name_en, numeric_level: selected.numeric_level != null ? String(selected.numeric_level) : "" });
  }, [selected]);

  function saveClass() {
    if (!cf.name_bn && !cf.name_en) { toast({ title: t("নাম আবশ্যক", "Name required"), variant: "error" }); return; }
    upsertClass.mutate(cf, {
      onSuccess: (id) => { toast({ title: t("শ্রেণি সংরক্ষিত", "Class saved"), variant: "success" }); if (!cf.id) setSelectedId(id as string); },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
    });
  }
  function newClass() { setSelectedId(null); setCf({ ...EMPTY_CLASS }); }
  function removeClass() {
    if (!delClassId) return; const id = delClassId; setDelClassId(null);
    deleteClass.mutate(id, {
      onSuccess: () => { toast({ title: t("মুছে ফেলা হয়েছে", "Deleted"), variant: "success" }); if (selectedId === id) setSelectedId(null); },
      onError: (e: unknown) => toast({ title: msg(e), variant: "error" }),
    });
  }

  function addSection() {
    if (!selectedId) return;
    if (!sf.section_name && !sf.id) { toast({ title: t("শাখার নাম আবশ্যক", "Section name required"), variant: "error" }); return; }
    upsertSection.mutate(
      { id: sf.id || undefined, class_id: selectedId, section_name: sf.section_name || undefined, capacity: sf.capacity, class_teacher_id: sf.class_teacher_id },
      {
        onSuccess: () => { toast({ title: t("শাখা সংরক্ষিত", "Section saved"), variant: "success" }); setSf({ ...EMPTY_SECTION }); },
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
      },
    );
  }
  function removeSection() {
    if (!delSectionId) return; const id = delSectionId; setDelSectionId(null);
    deleteSection.mutate(id, {
      onSuccess: () => toast({ title: t("মুছে ফেলা হয়েছে", "Deleted"), variant: "success" }),
      onError: (e: unknown) => toast({ title: msg(e), variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex flex-wrap items-start gap-3">
        <PageHeader
          crumbs={[{ label: t("কোর সেটিংস", "Core Settings"), href: "/admin/core/basic-config" }, { label: t("প্রতিষ্ঠান সেটিংস", "Institution Settings") }, { label: t("ক্লাস কনফিগ", "Class Config") }]}
          title={t("ক্লাস ও শাখা কনফিগারেশন", "Class & Section Configuration")}
          subtitle={t("শ্রেণি ও শাখা তৈরি, ধারণক্ষমতা ও শ্রেণি শিক্ষক নির্ধারণ", "Create classes & sections, set capacity and class teachers")}
          className="flex-1"
        />
        <Button variant="primary" onClick={newClass}><Plus size={16} /> {t("নতুন শ্রেণি", "New class")}</Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border-default bg-surface shadow-e1">
          <div className="flex items-center gap-2 bg-sunken px-4.5 py-3.5">
            <p className="text-body font-semibold text-text-primary">{t("শ্রেণিসমূহ", "Classes")}</p>
            <div className="flex-1" />
            <span className="text-meta text-text-muted">{t(`${n(rows.length)}টি`, `${n(rows.length)}`)}</span>
          </div>
          {rows.length === 0 ? (
            <div className="p-5"><EmptyState icon={<GraduationCap size={22} />} title={t("কোনো শ্রেণি নেই", "No classes yet")} /></div>
          ) : rows.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 border-b border-border-default px-4.5 py-3 text-left last:border-0",
                r.id === selectedId && "bg-primary-subtle",
              )}
            >
              <span className={cn("text-sm", r.id === selectedId ? "font-semibold text-text-primary" : "font-medium text-text-secondary")}>{isBn ? r.name_bn : r.name_en}</span>
              <span className="text-xs text-text-muted">{t(`${n(r.sectionCount)} শাখা`, `${n(r.sectionCount)} sections`)}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-5">
          <FormCard
            title={cf.id ? t(`${cf.name_bn || cf.name_en} — বিন্যাস`, `${cf.name_bn || cf.name_en} — Format`) : t("নতুন শ্রেণি", "New class")}
            action={<Button variant="secondary" onClick={saveClass} disabled={upsertClass.isPending}><Plus size={14} /> {cf.id ? t("হালনাগাদ", "Update") : t("যোগ করুন", "Add")}</Button>}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t("নাম (বাংলা)", "Name (Bangla)")} required><Input value={cf.name_bn} onChange={(e) => setCf((p) => ({ ...p, name_bn: e.target.value }))} placeholder={t("৯ম শ্রেণি", "Class 9")} /></Field>
              <Field label={t("Name (English)", "Name (English)")} required><Input value={cf.name_en} onChange={(e) => setCf((p) => ({ ...p, name_en: e.target.value }))} className="font-latin" placeholder="Class 9" /></Field>
              <Field label={t("সংখ্যাসূচক মান", "Numeric value")}><Input type="number" value={cf.numeric_level} onChange={(e) => setCf((p) => ({ ...p, numeric_level: e.target.value }))} className="font-latin" /></Field>
            </div>
            {cf.id ? (
              <button onClick={() => setDelClassId(cf.id)} className="flex w-fit items-center gap-1.5 text-meta font-semibold text-danger-fg hover:underline"><Trash2 size={14} /> {t("শ্রেণি মুছুন", "Delete class")}</button>
            ) : null}
          </FormCard>

          {selectedId ? (
            <FormCard title={t("শাখাসমূহ", "Sections")}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_1fr_auto] sm:items-end">
                <Field label={t("শাখার নাম", "Section name")}><Input value={sf.section_name} onChange={(e) => setSf((p) => ({ ...p, section_name: e.target.value }))} placeholder={t("ক", "A")} /></Field>
                <Field label={t("ধারণক্ষমতা", "Capacity")}><Input type="number" value={sf.capacity} onChange={(e) => setSf((p) => ({ ...p, capacity: e.target.value }))} className="font-latin" /></Field>
                <Field label={t("শ্রেণি শিক্ষক", "Class teacher")}>
                  <Select value={sf.class_teacher_id} placeholder={teachers.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন", "Select")} options={(teachers.data ?? []).map((tc) => ({ value: tc.id, label: tc.label }))} onChange={(e) => setSf((p) => ({ ...p, class_teacher_id: e.target.value }))} />
                </Field>
                <Button variant="primary" onClick={addSection} disabled={upsertSection.isPending}><Plus size={14} /> {sf.id ? t("হালনাগাদ", "Update") : t("শাখা যোগ করুন", "Add section")}</Button>
              </div>

              {/* A real <table>: this is four columns of section data with
                  headers, and nested flex <div>s gave a screen reader an
                  undifferentiated wall of text (SRA A-0.7 / WCAG 1.3.1). */}
              <Table minWidth={560}>
                <THead>
                  <TR>
                    <TH>{t("শাখা", "Section")}</TH>
                    <TH className="w-25">{t("ধারণক্ষমতা", "Capacity")}</TH>
                    <TH className="w-20">{t("ভর্তি", "Enrolled")}</TH>
                    <TH>{t("শ্রেণি শিক্ষক", "Class teacher")}</TH>
                    <TH className="w-12"><span className="sr-only">{t("অ্যাকশন", "Actions")}</span></TH>
                  </TR>
                </THead>
                <TBody>
                  {sections.isLoading ? (
                    <TR><TD colSpan={5} className="text-meta text-text-muted">{t("লোড হচ্ছে…", "Loading…")}</TD></TR>
                  ) : (sections.data ?? []).length === 0 ? (
                    <TableEmpty colSpan={5} icon={<Users size={20} />} title={t("কোনো শাখা নেই", "No sections yet")} />
                  ) : (sections.data ?? []).map((s) => (
                    <TR key={s.id}>
                      <TD>
                        <span className="flex items-center gap-2">
                          <span className="grid size-7 place-items-center rounded-lg bg-primary-subtle text-sm font-bold text-primary">{s.sectionName.slice(0, 1)}</span>
                          <span className="text-sm font-semibold text-text-primary">{t(`শাখা ${s.sectionName}`, s.sectionName)}</span>
                        </span>
                      </TD>
                      <TD className="text-meta text-text-secondary tnum">{s.capacity != null ? n(s.capacity) : "—"}</TD>
                      <TD className="text-meta font-semibold text-text-primary tnum">{n(s.enrolled)}</TD>
                      <TD className="text-meta text-text-secondary">{s.classTeacherName ?? "—"}</TD>
                      <TD>
                        <button onClick={() => setDelSectionId(s.id)} aria-label={t(`শাখা ${s.sectionName} মুছুন`, `Delete section ${s.sectionName}`)} className="grid size-9 shrink-0 place-items-center rounded-md text-danger-fg hover:bg-sunken"><Trash2 size={15} /></button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </FormCard>
          ) : null}
        </div>
      </div>

      <ConfirmDialog open={!!delClassId} onClose={() => setDelClassId(null)} onConfirm={removeClass} tone="danger" title={t("শ্রেণি মুছবেন?", "Delete class?")} description={t("এই শ্রেণির সকল শাখাও প্রভাবিত হবে।", "All sections under this class will be affected too.")} confirmLabel={t("মুছুন", "Delete")} cancelLabel={t("বাতিল", "Cancel")} loading={deleteClass.isPending} />
      <ConfirmDialog open={!!delSectionId} onClose={() => setDelSectionId(null)} onConfirm={removeSection} tone="danger" title={t("শাখা মুছবেন?", "Delete section?")} confirmLabel={t("মুছুন", "Delete")} cancelLabel={t("বাতিল", "Cancel")} loading={deleteSection.isPending} />
    </div>
  );
}
