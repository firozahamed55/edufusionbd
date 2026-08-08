"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Layers, Search } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Field, Input, Button, EmptyState, ConfirmDialog, Modal, useToast, PageHeader, Checkbox, ImpactPreview,
} from "@/shared/ui";
import { useZodForm } from "@/shared/lib/useZodForm";
import { useSubjectGroups, useSubjects, useUpsertGroup, useDeleteGroup, useClasses } from "../../logic/hooks";
import { subjectGroupSchema } from "../../logic/schemas";
import { useEntityImpact, useImpactLabel } from "../../logic/impact";
import { useErrorMessage } from "@/shared/services/errors";

const EMPTY = {
  id: "", name: "", name_bn: "",
  subject_ids: [] as string[], elective_ids: [] as string[], elective_pick: "",
  class_ids: [] as string[], takenNames: [] as string[],
};

/**
 * Core · Subject Group.
 *
 * Three defects this screen shipped with, all of the same shape — a record that
 * saves successfully and then does nothing:
 *
 *   • a group with ZERO subjects saved happily and rendered "No subjects"
 *     (S-7.1). It is a valid-looking row and a silent no-op in elective
 *     assignment, which is the only thing groups exist for.
 *   • duplicate group names were accepted (S-7.2), so "Science" and "Science"
 *     both appear in a picker and neither is identifiable.
 *   • the group carried a single untranslated `name` while every sibling entity
 *     carries `name_bn`/`name_en` (S-7.9), so a Bangla operator read an English
 *     label sitting next to Bangla subject chips.
 *
 * The picker was also an unsearchable `max-h-56` scroll list (S-7.4): usable at
 * five subjects, unusable at forty, which is what a real school has.
 */
export function SubjectGroupScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const groups = useSubjectGroups();
  const subjects = useSubjects();
  const classes = useClasses();
  const upsert = useUpsertGroup();
  const del = useDeleteGroup();
  const [open, setOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");

  const form = useZodForm(subjectGroupSchema, EMPTY);
  const f = form.values;

  const impact = useEntityImpact("subject_group", delId);
  const impactLabel = useImpactLabel();

  /** Names held by every OTHER group — the uniqueness check's input. */
  const takenNames = (id: string) =>
    (groups.data ?? []).filter((g) => g.id !== id).map((g) => g.name.trim().toLowerCase());

  function openNew() {
    form.reset({ ...EMPTY, takenNames: takenNames("") });
    setPickerQuery("");
    setOpen(true);
  }
  function openEdit(g: NonNullable<typeof groups.data>[number]) {
    form.reset({
      id: g.id, name: g.name, name_bn: g.name_bn ?? "",
      subject_ids: [...g.subject_ids],
      elective_ids: g.members.filter((m) => m.is_elective).map((m) => m.id),
      elective_pick: g.elective_pick != null ? String(g.elective_pick) : "",
      class_ids: [...g.class_ids],
      takenNames: takenNames(g.id),
    });
    setPickerQuery("");
    setOpen(true);
  }

  const toggle = (sid: string) => {
    const on = f.subject_ids.includes(sid);
    form.setValue("subject_ids", on ? f.subject_ids.filter((x) => x !== sid) : [...f.subject_ids, sid]);
    // Removing a subject must remove it from the elective pool too, or the
    // group carries an elective that is not in it.
    if (on) form.setValue("elective_ids", f.elective_ids.filter((x) => x !== sid));
    // The list is not a `Field`, so nothing would ever mark it touched and the
    // "choose at least one subject" error would stay invisible until submit.
    form.touch("subject_ids");
  };

  /** Compulsory <-> elective for a subject already in the group (S-7.6). */
  const toggleElective = (sid: string) => {
    form.setValue(
      "elective_ids",
      f.elective_ids.includes(sid) ? f.elective_ids.filter((x) => x !== sid) : [...f.elective_ids, sid],
    );
    form.touch("elective_pick");
  };

  const toggleClass = (cid: string) => {
    form.setValue("class_ids", f.class_ids.includes(cid) ? f.class_ids.filter((x) => x !== cid) : [...f.class_ids, cid]);
  };

  function save() {
    const parsed = form.submit();
    if (!parsed) { form.focusFirstError(); return; }
    upsert.mutate(
      {
        id: parsed.id || undefined,
        name: parsed.name,
        name_bn: parsed.name_bn,
        // {id, is_elective} per subject — the RPC still accepts a bare uuid, so
        // the bulk importer is unaffected.
        subject_ids: parsed.subject_ids.map((id) => ({ id, is_elective: parsed.elective_ids.includes(id) })),
        elective_pick: parsed.elective_pick,
        class_ids: parsed.class_ids,
      },
      {
        onSuccess: () => { toast({ title: t("গ্রুপ সংরক্ষিত", "Group saved"), variant: "success" }); setOpen(false); },
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
      },
    );
  }

  function remove() {
    if (!delId || impact.data?.blocking) return;
    const d = delId; setDelId(null);
    del.mutate(d, {
      onSuccess: () => toast({ title: t("মুছে ফেলা হয়েছে", "Deleted"), variant: "success" }),
      onError: (e: unknown) => toast({ title: msg(e), variant: "error" }),
    });
  }

  const subs = useMemo(() => subjects.data ?? [], [subjects.data]);
  const rows = groups.data ?? [];
  const deleting = rows.find((g) => g.id === delId) ?? null;

  const pickerRows = useMemo(() => {
    const term = pickerQuery.trim().toLowerCase();
    if (!term) return subs;
    return subs.filter(
      (s) => s.name_bn.includes(pickerQuery.trim()) || s.name_en.toLowerCase().includes(term) || (s.code ?? "").toLowerCase().includes(term),
    );
  }, [subs, pickerQuery]);

  const groupLabel = (g: NonNullable<typeof groups.data>[number]) => (isBn && g.name_bn ? g.name_bn : g.name);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex flex-wrap items-start gap-3">
        <PageHeader
          crumbs={[{ label: t("সেটিংস", "Settings"), href: "/admin/core" }, { label: t("বিষয় সেটিংস", "Subject Settings") }, { label: t("বিষয় গ্রুপ", "Subject Group") }]}
          title={t("বিষয় গ্রুপ", "Subject Group")}
          subtitle={t("বিভাগভিত্তিক বিষয় গ্রুপ ও ঐচ্ছিক বিষয় ব্যবস্থাপনা", "Manage department-wise subject groups & electives")}
          className="flex-1"
        />
        <Button variant="primary" onClick={openNew}><Plus size={16} /> {t("নতুন গ্রুপ", "New group")}</Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-surface p-5 shadow-e1"><EmptyState icon={<Layers size={22} />} title={t("কোনো গ্রুপ নেই", "No groups yet")} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {rows.map((g) => (
            <div key={g.id} className="flex flex-col gap-3.5 rounded-2xl border border-border-default bg-surface p-4.5 shadow-e1">
              <div className="flex items-center gap-3">
                <span className="grid size-10.5 shrink-0 place-items-center rounded-lg bg-primary-subtle text-lg font-bold text-primary">{groupLabel(g).slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-text-primary">{groupLabel(g)}</p>
                  <p className="text-micro text-text-muted">{t(`${n(g.subject_ids.length)}টি বিষয়`, `${n(g.subject_ids.length)} subjects`)}</p>
                </div>
                <button onClick={() => openEdit(g)} aria-label={t(`${groupLabel(g)} সম্পাদনা`, `Edit ${g.name}`)} className="grid size-8.5 shrink-0 place-items-center rounded-lg border border-border-strong text-text-secondary hover:bg-sunken"><Pencil size={15} /></button>
                <button onClick={() => setDelId(g.id)} aria-label={t(`${groupLabel(g)} মুছুন`, `Delete ${g.name}`)} className="grid size-8.5 shrink-0 place-items-center rounded-lg border border-border-strong text-danger-fg hover:bg-sunken"><Trash2 size={15} /></button>
              </div>
              {/* S-7.5: a "Science" group means nothing until it is attached to
                  classes 9 and 10, and that relationship was absent from the UI
                  entirely — so an unattached group looked exactly like a
                  working one. */}
              <p className="text-meta">
                {g.class_ids.length === 0 ? (
                  <span className="text-warning-fg">{t("কোনো শ্রেণিতে যুক্ত নয় — এখনও ব্যবহার হচ্ছে না", "Not attached to any class — not in use yet")}</span>
                ) : (
                  <>
                    <span className="text-text-muted">{t("প্রযোজ্য: ", "Applies to: ")}</span>
                    <span className="text-text-secondary">
                      {(classes.data ?? []).filter((c) => g.class_ids.includes(c.id)).map((c) => (isBn ? c.name_bn : c.name_en)).join(", ")}
                    </span>
                  </>
                )}
              </p>

              {g.members.length > 0 ? (
                <>
                  <p className="text-meta font-semibold text-text-secondary">
                    {t(`বিষয়সমূহ (${n(g.members.length)})`, `Subjects (${n(g.members.length)})`)}
                    {g.elective_pick != null ? (
                      <span className="ml-2 font-normal text-text-muted">
                        {t(`ঐচ্ছিক থেকে ${n(g.elective_pick)}টি নিতে হবে`, `pick ${g.elective_pick} from the electives`)}
                      </span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {g.members.map((m) => (
                      <span
                        key={m.id}
                        className={m.is_elective
                          ? "rounded-full border border-primary/40 bg-primary-subtle px-2.5 py-1.5 text-meta font-medium text-primary"
                          : "rounded-full bg-sunken px-2.5 py-1.5 text-meta font-medium text-text-secondary"}
                      >
                        {isBn ? m.name_bn : m.name_en}
                        {m.is_elective ? <span className="sr-only"> ({t("ঐচ্ছিক", "elective")})</span> : null}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-meta text-text-muted">{t("কোনো বিষয় নেই", "No subjects")}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={f.id ? t("গ্রুপ সম্পাদনা", "Edit group") : t("নতুন গ্রুপ", "New group")}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t("বাতিল", "Cancel")}</Button><Button variant="primary" onClick={save} disabled={upsert.isPending}>{upsert.isPending ? t("সংরক্ষণ…", "Saving…") : t("সংরক্ষণ করুন", "Save")}</Button></>}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("গ্রুপের নাম (English)", "Group name (English)")} required {...form.bind("name")}>
              <Input id="f-name" value={f.name} onChange={(e) => form.setValue("name", e.target.value)} className="font-latin" placeholder="Science" />
            </Field>
            <Field label={t("গ্রুপের নাম (বাংলা)", "Group name (Bangla)")} {...form.bind("name_bn")}>
              <Input id="f-name_bn" value={f.name_bn} onChange={(e) => form.setValue("name_bn", e.target.value)} placeholder={t("বিজ্ঞান", "বিজ্ঞান")} />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span id="group-subjects-label" className="flex-1 text-meta font-medium text-text-secondary">
                {t("বিষয় নির্বাচন", "Select subjects")}
                <span className="text-danger-fg"> *</span>
              </span>
              <span className="text-micro text-text-muted">
                {t(`${n(f.subject_ids.length)}টি নির্বাচিত`, `${n(f.subject_ids.length)} selected`)}
              </span>
            </div>

            {/* S-7.4: an unsearchable scroll list is fine at five subjects and
                unusable at forty, which is what a real school carries. */}
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                aria-label={t("বিষয় খুঁজুন", "Search subjects")}
                placeholder={t("বিষয় খুঁজুন", "Search subjects")}
                className="h-9.5 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-3 text-meta text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
              />
            </div>

            <div
              role="group"
              aria-labelledby="group-subjects-label"
              className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border-default p-2"
            >
              {subs.length === 0 ? (
                <p className="p-2 text-meta text-text-muted">{t("প্রথমে বিষয় যোগ করুন", "Add subjects first")}</p>
              ) : pickerRows.length === 0 ? (
                <p className="p-2 text-meta text-text-muted">{t("কিছু মেলেনি", "Nothing matched")}</p>
              ) : pickerRows.map((s) => {
                const picked = f.subject_ids.includes(s.id);
                const elective = f.elective_ids.includes(s.id);
                return (
                  <div key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sunken">
                    <label className="flex min-w-0 flex-1 items-center gap-2 text-meta text-text-secondary">
                      {/* A-9: was a raw <input type="checkbox">, so it carried
                          none of the shared focus-ring or hit-target treatment. */}
                      <Checkbox checked={picked} onChange={() => toggle(s.id)} />
                      <span className="truncate">{isBn ? s.name_bn : s.name_en}</span>
                    </label>
                    {/* S-7.6: compulsory vs elective. Only meaningful once the
                        subject is in the group, so it appears with it. */}
                    {picked ? (
                      <button
                        type="button"
                        onClick={() => toggleElective(s.id)}
                        aria-pressed={elective}
                        className={elective
                          ? "shrink-0 rounded-full border border-primary/40 bg-primary-subtle px-2 py-0.5 text-micro font-medium text-primary"
                          : "shrink-0 rounded-full border border-border-default px-2 py-0.5 text-micro text-text-muted hover:border-border-strong"}
                      >
                        {elective ? t("ঐচ্ছিক", "Elective") : t("আবশ্যিক", "Compulsory")}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {form.errors.subject_ids ? (
              <span role="alert" className="text-micro font-medium text-danger-fg">{form.errors.subject_ids}</span>
            ) : null}
          </div>

          {/* The pick-N rule. Only shown once there is a pool to pick from —
              "choose 1 of 0" is not a question worth asking. */}
          {f.elective_ids.length > 0 ? (
            <Field
              label={t("ঐচ্ছিক থেকে কতটি নিতে হবে", "How many electives a student takes")}
              hint={t(
                `${n(f.elective_ids.length)}টি ঐচ্ছিক বিষয় চিহ্নিত — যেমন “৩টির মধ্যে ১টি”`,
                `${f.elective_ids.length} subjects marked elective — e.g. "1 of 3"`,
              )}
              {...form.bind("elective_pick")}
            >
              <Input
                id="f-elective_pick"
                type="number"
                min={1}
                max={f.elective_ids.length}
                value={f.elective_pick}
                onChange={(e) => form.setValue("elective_pick", e.target.value)}
                className="w-24 font-latin"
              />
            </Field>
          ) : null}

          {/* S-7.5 */}
          <div className="flex flex-col gap-2">
            <span id="group-classes-label" className="text-meta font-medium text-text-secondary">
              {t("কোন শ্রেণিতে প্রযোজ্য", "Which classes this applies to")}
            </span>
            <div role="group" aria-labelledby="group-classes-label" className="flex flex-wrap gap-2">
              {(classes.data ?? []).length === 0 ? (
                <p className="text-meta text-text-muted">{t("প্রথমে শ্রেণি যোগ করুন", "Add classes first")}</p>
              ) : (classes.data ?? []).map((c) => {
                const on = f.class_ids.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleClass(c.id)}
                    aria-pressed={on}
                    className={on
                      ? "rounded-full border border-primary bg-primary-subtle px-3 py-1.5 text-meta font-medium text-primary"
                      : "rounded-full border border-border-default px-3 py-1.5 text-meta text-text-secondary hover:border-border-strong"}
                  >
                    {isBn ? c.name_bn : c.name_en}
                  </button>
                );
              })}
            </div>
            {f.class_ids.length === 0 ? (
              <p className="text-micro text-text-muted">
                {t(
                  "কোনো শ্রেণি না দিলে গ্রুপটি সংরক্ষিত হবে কিন্তু কোথাও ব্যবহৃত হবে না।",
                  "With no class selected the group saves, but nothing uses it.",
                )}
              </p>
            ) : null}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!delId}
        onClose={() => setDelId(null)}
        onConfirm={remove}
        tone="danger"
        title={t("গ্রুপ মুছবেন?", "Delete group?")}
        description={deleting ? groupLabel(deleting) : undefined}
        confirmLabel={t("মুছুন", "Delete")}
        cancelLabel={t("বাতিল", "Cancel")}
        confirmDisabled={impact.isLoading || impact.data?.blocking}
        loading={del.isPending}
      >
        <ImpactPreview
          items={impact.data?.items ?? []}
          loading={impact.isLoading}
          label={impactLabel}
          emptyLabel={t("এই গ্রুপে কোনো বিষয় নেই।", "This group holds no subjects.")}
        />
      </ConfirmDialog>
    </div>
  );
}
