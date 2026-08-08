"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, GraduationCap, Users, Pencil, X } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import {
  FormCard, Field, Input, Select, Button, EmptyState, ConfirmDialog, useToast, PageHeader,
  ImpactPreview, Table, THead, TBody, TR, TH, TD, TableEmpty,
} from "@/shared/ui";
import { useZodForm } from "@/shared/lib/useZodForm";
import { useGridNavigation } from "@/shared/lib/useGridNavigation";
import {
  useClasses, useUpsertClass, useDeleteClass,
  useClassSections, useUpsertClassSection, useDeleteClassSection, useTeacherOptions,
} from "../../logic/hooks";
import { classSchema, sectionSchema } from "../../logic/schemas";
import { useEntityImpact, useImpactLabel } from "../../logic/impact";
import { useErrorMessage } from "@/shared/services/errors";

const EMPTY_CLASS = { id: "", name_bn: "", name_en: "", numeric_level: "", takenLevels: [] as number[] };
const EMPTY_SECTION = { id: "", section_name: "", capacity: "", class_teacher_id: "", enrolled: 0 };

/**
 * Core · Class & Section Configuration.
 *
 * THE FUNCTIONAL DEAD END (audit S-3.4). The section form doubled as an edit
 * form — it reads `sf.id` and sends it — but the table row had only a delete
 * button and nothing in the screen ever set `sf.id`. So a section's capacity or
 * class teacher could not be changed through the UI at all, only deleted and
 * recreated, which loses the enrolment. The edit button below is the whole fix,
 * and it is the kind of gap that survives review because the code that would
 * handle it is right there and looks used.
 *
 * Also closed: duplicate `numeric_level` (S-3.2 — two classes at level 9 make
 * ordering ambiguous everywhere), capacity below current enrolment (S-3.3 —
 * accepted, then reported as permanent over-subscription), a half-typed section
 * carrying into a different class (S-3.6), and a class list of bare `<button>`s
 * with no roving focus or `aria-current` (S-3.7).
 */
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
  const [delClassId, setDelClassId] = useState<string | null>(null);
  const [delSectionId, setDelSectionId] = useState<string | null>(null);

  const classForm = useZodForm(classSchema, EMPTY_CLASS);
  const sectionForm = useZodForm(sectionSchema, EMPTY_SECTION);
  const cf = classForm.values;
  const sf = sectionForm.values;

  const rows = classes.data ?? [];
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const sections = useClassSections(selectedId);

  const classImpact = useEntityImpact("class", delClassId);
  const sectionImpact = useEntityImpact("class_section", delSectionId);
  const impactLabel = useImpactLabel();

  const list = useGridNavigation({ rows: rows.length, cols: 1 });

  useEffect(() => {
    if (!selectedId && classes.data && classes.data.length > 0) setSelectedId(classes.data[0].id);
  }, [classes.data, selectedId]);

  const { reset: resetClassForm } = classForm;
  const { reset: resetSectionForm } = sectionForm;

  useEffect(() => {
    if (!selected) return;
    resetClassForm({
      id: selected.id,
      name_bn: selected.name_bn,
      name_en: selected.name_en,
      numeric_level: selected.numeric_level != null ? String(selected.numeric_level) : "",
      takenLevels: rows.filter((r) => r.id !== selected.id && r.numeric_level != null).map((r) => r.numeric_level as number),
    });
    // S-3.6: switching class used to carry a half-typed section draft across,
    // so "Section ক, capacity 40" typed for Class 6 landed on Class 7.
    resetSectionForm({ ...EMPTY_SECTION });
    // `rows` is deliberately not a dep: it changes identity on every refetch and
    // would clobber an in-progress edit of the class currently selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, resetClassForm, resetSectionForm]);

  function saveClass() {
    const parsed = classForm.submit();
    if (!parsed) { classForm.focusFirstError("fc-"); return; }
    upsertClass.mutate(
      { id: parsed.id, name_bn: parsed.name_bn, name_en: parsed.name_en, numeric_level: parsed.numeric_level },
      {
        onSuccess: (id) => { toast({ title: t("শ্রেণি সংরক্ষিত", "Class saved"), variant: "success" }); if (!parsed.id) setSelectedId(id as string); },
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
      },
    );
  }
  function newClass() {
    setSelectedId(null);
    resetClassForm({ ...EMPTY_CLASS, takenLevels: rows.filter((r) => r.numeric_level != null).map((r) => r.numeric_level as number) });
    resetSectionForm({ ...EMPTY_SECTION });
  }
  function removeClass() {
    if (!delClassId || classImpact.data?.blocking) return;
    const id = delClassId; setDelClassId(null);
    deleteClass.mutate(id, {
      onSuccess: () => { toast({ title: t("মুছে ফেলা হয়েছে", "Deleted"), variant: "success" }); if (selectedId === id) setSelectedId(null); },
      onError: (e: unknown) => toast({ title: msg(e), variant: "error" }),
    });
  }

  function editSection(s: NonNullable<typeof sections.data>[number]) {
    resetSectionForm({
      id: s.id,
      section_name: s.sectionName,
      capacity: s.capacity != null ? String(s.capacity) : "",
      class_teacher_id: "",
      enrolled: s.enrolled,
    });
  }

  function saveSection() {
    if (!selectedId) return;
    const parsed = sectionForm.submit();
    if (!parsed) { sectionForm.focusFirstError("fs-"); return; }
    upsertSection.mutate(
      {
        id: parsed.id || undefined, class_id: selectedId,
        section_name: parsed.section_name, capacity: parsed.capacity,
        class_teacher_id: parsed.class_teacher_id,
      },
      {
        onSuccess: () => { toast({ title: t("শাখা সংরক্ষিত", "Section saved"), variant: "success" }); resetSectionForm({ ...EMPTY_SECTION }); },
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
      },
    );
  }
  function removeSection() {
    if (!delSectionId || sectionImpact.data?.blocking) return;
    const id = delSectionId; setDelSectionId(null);
    deleteSection.mutate(id, {
      onSuccess: () => toast({ title: t("মুছে ফেলা হয়েছে", "Deleted"), variant: "success" }),
      onError: (e: unknown) => toast({ title: msg(e), variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex flex-wrap items-start gap-3">
        <PageHeader
          crumbs={[{ label: t("সেটিংস", "Settings"), href: "/admin/core" }, { label: t("প্রতিষ্ঠান সেটিংস", "Institution Settings") }, { label: t("ক্লাস কনফিগ", "Class Config") }]}
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
          ) : (
            /* S-3.7: a listbox, not a column of buttons — one tab stop, arrow
               keys between options, and `aria-selected` on the current one. */
            <div role="listbox" aria-label={t("শ্রেণিসমূহ", "Classes")}>
              {rows.map((r, i) => (
                <button
                  key={r.id}
                  role="option"
                  aria-selected={r.id === selectedId}
                  ref={list.register(i, 0)}
                  onKeyDown={list.onKeyDown(i, 0)}
                  /* Roving tabindex anchored on the selection: one tab stop for
                     the whole list, arrows between options. */
                  tabIndex={r.id === selectedId || (selectedId === null && i === 0) ? 0 : -1}
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
          )}
        </div>

        <div className="flex flex-col gap-5">
          <FormCard
            title={cf.id ? t(`${cf.name_bn || cf.name_en} — বিন্যাস`, `${cf.name_bn || cf.name_en} — Format`) : t("নতুন শ্রেণি", "New class")}
            action={<Button variant="secondary" onClick={saveClass} disabled={upsertClass.isPending}><Plus size={14} /> {cf.id ? t("হালনাগাদ", "Update") : t("যোগ করুন", "Add")}</Button>}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label={t("নাম (বাংলা)", "Name (Bangla)")} required {...classForm.bind("name_bn")}>
                <Input id="fc-name_bn" value={cf.name_bn} onChange={(e) => classForm.setValue("name_bn", e.target.value)} placeholder={t("৯ম শ্রেণি", "Class 9")} />
              </Field>
              <Field label={t("Name (English)", "Name (English)")} required {...classForm.bind("name_en")}>
                <Input id="fc-name_en" value={cf.name_en} onChange={(e) => classForm.setValue("name_en", e.target.value)} className="font-latin" placeholder="Class 9" />
              </Field>
              <Field
                label={t("সংখ্যাসূচক মান", "Numeric value")}
                hint={t("শ্রেণির ক্রম নির্ধারণ করে — প্রতিটি শ্রেণির আলাদা হতে হবে", "Sets class order — must be unique")}
                {...classForm.bind("numeric_level")}
              >
                <Input id="fc-numeric_level" type="number" value={cf.numeric_level} onChange={(e) => classForm.setValue("numeric_level", e.target.value)} className="font-latin" />
              </Field>
            </div>
            {cf.id ? (
              <button onClick={() => setDelClassId(cf.id)} className="flex w-fit items-center gap-1.5 text-meta font-semibold text-danger-fg hover:underline"><Trash2 size={14} /> {t("শ্রেণি মুছুন", "Delete class")}</button>
            ) : null}
          </FormCard>

          {selectedId ? (
            <FormCard title={sf.id ? t("শাখা সম্পাদনা", "Edit section") : t("শাখাসমূহ", "Sections")}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_1fr_auto] sm:items-end">
                <Field label={t("শাখার নাম", "Section name")} required {...sectionForm.bind("section_name")}>
                  <Input id="fs-section_name" value={sf.section_name} onChange={(e) => sectionForm.setValue("section_name", e.target.value)} placeholder={t("ক", "A")} />
                </Field>
                <Field label={t("ধারণক্ষমতা", "Capacity")} {...sectionForm.bind("capacity")}>
                  <Input id="fs-capacity" type="number" value={sf.capacity} onChange={(e) => sectionForm.setValue("capacity", e.target.value)} className="font-latin" />
                </Field>
                <Field label={t("শ্রেণি শিক্ষক", "Class teacher")}>
                  <Select value={sf.class_teacher_id} placeholder={teachers.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন", "Select")} options={(teachers.data ?? []).map((tc) => ({ value: tc.id, label: tc.label }))} onChange={(e) => sectionForm.setValue("class_teacher_id", e.target.value)} />
                </Field>
                <div className="flex gap-2">
                  <Button variant="primary" onClick={saveSection} disabled={upsertSection.isPending}>
                    <Plus size={14} /> {sf.id ? t("হালনাগাদ", "Update") : t("শাখা যোগ করুন", "Add section")}
                  </Button>
                  {sf.id ? (
                    <Button variant="ghost" onClick={() => resetSectionForm({ ...EMPTY_SECTION })} aria-label={t("সম্পাদনা বাতিল", "Cancel edit")}>
                      <X size={15} />
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* A real <table>: this is four columns of section data with
                  headers, and nested flex <div>s gave a screen reader an
                  undifferentiated wall of text (SRA A-0.7 / WCAG 1.3.1). */}
              <Table minWidth={620}>
                <THead>
                  <TR>
                    <TH>{t("শাখা", "Section")}</TH>
                    <TH className="w-32">{t("ভর্তি / ধারণক্ষমতা", "Enrolled / capacity")}</TH>
                    <TH>{t("শ্রেণি শিক্ষক", "Class teacher")}</TH>
                    <TH className="w-20"><span className="sr-only">{t("অ্যাকশন", "Actions")}</span></TH>
                  </TR>
                </THead>
                <TBody>
                  {sections.isLoading ? (
                    <TR><TD colSpan={4} className="text-meta text-text-muted">{t("লোড হচ্ছে…", "Loading…")}</TD></TR>
                  ) : (sections.data ?? []).length === 0 ? (
                    <TableEmpty colSpan={4} icon={<Users size={20} />} title={t("কোনো শাখা নেই", "No sections yet")} />
                  ) : (sections.data ?? []).map((s) => {
                    const over = s.capacity != null && s.enrolled > s.capacity;
                    return (
                      <TR key={s.id}>
                        <TD>
                          <span className="flex items-center gap-2">
                            <span className="grid size-7 place-items-center rounded-lg bg-primary-subtle text-sm font-bold text-primary">{s.sectionName.slice(0, 1)}</span>
                            <span className="text-sm font-semibold text-text-primary">{t(`শাখা ${s.sectionName}`, s.sectionName)}</span>
                          </span>
                        </TD>
                        {/* S-3.3: enrolled and capacity as a ratio, with the
                            over-subscription actually marked. */}
                        <TD className={cn("text-meta tnum", over ? "font-semibold text-danger-fg" : "text-text-secondary")}>
                          {n(s.enrolled)} / {s.capacity != null ? n(s.capacity) : "—"}
                          {over ? <span className="ml-1 text-micro">{t("(অতিরিক্ত)", "(over)")}</span> : null}
                        </TD>
                        <TD className="text-meta text-text-secondary">{s.classTeacherName ?? "—"}</TD>
                        <TD>
                          <div className="flex items-center justify-end gap-1">
                            {/* S-3.4: this button is the whole fix for a
                                section whose capacity could not be changed. */}
                            <button onClick={() => editSection(s)} aria-label={t(`শাখা ${s.sectionName} সম্পাদনা`, `Edit section ${s.sectionName}`)} className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-sunken"><Pencil size={15} /></button>
                            <button onClick={() => setDelSectionId(s.id)} aria-label={t(`শাখা ${s.sectionName} মুছুন`, `Delete section ${s.sectionName}`)} className="grid size-8 place-items-center rounded-md text-danger-fg hover:bg-sunken"><Trash2 size={15} /></button>
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </FormCard>
          ) : (
            <FormCard title={t("শাখাসমূহ", "Sections")}>
              {/* S-3.8: the panel used to vanish with no explanation. */}
              <p className="text-meta text-text-muted">
                {t("শ্রেণিটি সংরক্ষণ করার পর শাখা যোগ করা যাবে।", "Sections can be added once the class is saved.")}
              </p>
            </FormCard>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!delClassId}
        onClose={() => setDelClassId(null)}
        onConfirm={removeClass}
        tone="danger"
        title={t("শ্রেণি মুছবেন?", "Delete class?")}
        confirmLabel={t("মুছুন", "Delete")}
        cancelLabel={t("বাতিল", "Cancel")}
        confirmDisabled={classImpact.isLoading || classImpact.data?.blocking}
        loading={deleteClass.isPending}
      >
        <ImpactPreview
          items={classImpact.data?.items ?? []}
          loading={classImpact.isLoading}
          label={impactLabel}
          emptyLabel={t("এই শ্রেণির উপর কিছুই নির্ভর করছে না।", "Nothing depends on this class.")}
          blockedLabel={t(
            "এই শ্রেণির শাখায় শিক্ষার্থী ভর্তি আছে। আগে তাদের অন্য শ্রেণিতে মাইগ্রেট করুন।",
            "Students are enrolled in this class's sections. Migrate them to another class first.",
          )}
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={!!delSectionId}
        onClose={() => setDelSectionId(null)}
        onConfirm={removeSection}
        tone="danger"
        title={t("শাখা মুছবেন?", "Delete section?")}
        confirmLabel={t("মুছুন", "Delete")}
        cancelLabel={t("বাতিল", "Cancel")}
        confirmDisabled={sectionImpact.isLoading || sectionImpact.data?.blocking}
        loading={deleteSection.isPending}
      >
        <ImpactPreview
          items={sectionImpact.data?.items ?? []}
          loading={sectionImpact.isLoading}
          label={impactLabel}
          emptyLabel={t("এই শাখার উপর কিছুই নির্ভর করছে না।", "Nothing depends on this section.")}
          blockedLabel={t(
            "এই শাখায় শিক্ষার্থী ভর্তি আছে। আগে তাদের সরান।",
            "Students are enrolled in this section. Move them first.",
          )}
        />
      </ConfirmDialog>
    </div>
  );
}
