"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Award, X } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  Field, Input, Select, Button, Badge, EmptyState, ConfirmDialog, Modal, useToast, PageHeader,
  Table, THead, TBody, TR, TH, TD, Checkbox, ImpactPreview,
} from "@/shared/ui";
import { useGradeSchemes, useUpsertScheme, useDeleteScheme } from "../../logic/hooks";
import { validateGradeScale } from "../../logic/gradeScale";
import { useEntityImpact, useImpactLabel } from "../../logic/impact";
import type { GradeScale } from "../../logic/api";
import { useErrorMessage } from "@/shared/services/errors";

const DEFAULT_SCALES: GradeScale[] = [
  { grade_letter: "A+", gpa_point: 5, min_marks: 80, max_marks: 100 },
  { grade_letter: "A", gpa_point: 4, min_marks: 70, max_marks: 79 },
  { grade_letter: "A-", gpa_point: 3.5, min_marks: 60, max_marks: 69 },
  { grade_letter: "B", gpa_point: 3, min_marks: 50, max_marks: 59 },
  { grade_letter: "C", gpa_point: 2, min_marks: 40, max_marks: 49 },
  { grade_letter: "D", gpa_point: 1, min_marks: 33, max_marks: 39 },
  { grade_letter: "F", gpa_point: 0, min_marks: 0, max_marks: 32 },
];

const REMARKS: Record<string, [string, string]> = {
  "A+": ["অসাধারণ", "Excellent"], A: ["উত্তম", "Very Good"], "A-": ["ভালো", "Good"],
  B: ["সন্তোষজনক", "Satisfactory"], C: ["মোটামুটি", "Fair"], D: ["উত্তীর্ণ", "Pass"], F: ["অকৃতকার্য", "Fail"],
};
function gradeTone(letter: string): "success" | "info" | "warning" | "danger" {
  const l = letter[0];
  if (l === "A") return "success";
  if (l === "B") return "info";
  if (l === "F") return "danger";
  return "warning";
}

/**
 * Core · Grading Scheme.
 *
 * The highest-consequence unguarded action in the module used to live here
 * (audit S-8.5). Marks are stored; the bands that turn a mark into a letter are
 * not versioned. So editing a scheme that has already graded a cohort does not
 * change the marks — it changes what those marks MEAN, retroactively, and a
 * marksheet reprinted next year comes out with different grades from the one
 * the parent is holding. Nothing warned about it.
 *
 * The fix is a refusal rather than a warning, in both layers: the editor
 * refuses band edits once results exist and offers copy-to-new-scheme instead,
 * and `private.fn_check_grade_scheme` raises `CHK02` for any caller that skips
 * the browser.
 */
export function GradingScreen() {
  const { t, n } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const schemes = useGradeSchemes();
  const upsert = useUpsertScheme();
  const del = useDeleteScheme();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [scales, setScales] = useState<GradeScale[]>(DEFAULT_SCALES);
  const [delId, setDelId] = useState<string | null>(null);

  const rows = schemes.data ?? [];
  const impactLabel = useImpactLabel();
  const delImpact = useEntityImpact("grade_scheme", delId);
  /** What the scheme OPEN IN THE EDITOR is already responsible for (S-8.5). */
  const editImpact = useEntityImpact("grade_scheme", open && id ? id : null);
  const processed = editImpact.data?.items.find((i) => i.key === "processed_results")?.count ?? 0;
  /** True once the scheme has graded something: bands become read-only. */
  const bandsLocked = processed > 0;
  useEffect(() => { if (!activeId && schemes.data && schemes.data.length > 0) setActiveId(schemes.data[0].id); }, [schemes.data, activeId]);
  const active = rows.find((r) => r.id === activeId) ?? null;
  /** Which scheme ticking "default" would displace (audit S-8.3). */
  const currentDefault = rows.find((r) => r.is_default) ?? null;
  const sortedScales = useMemo(() => [...(active?.scales ?? [])].sort((a, b) => b.min_marks - a.min_marks), [active]);
  const passMark = sortedScales.filter((s) => s.gpa_point > 0).reduce((min, s) => Math.min(min, s.min_marks), Infinity);
  const maxGp = sortedScales.reduce((max, s) => Math.max(max, s.gpa_point), 0);

  function openNew() { setId(""); setName(""); setIsDefault(false); setScales(DEFAULT_SCALES); setOpen(true); }
  function openEdit() {
    if (!active) return;
    setId(active.id); setName(active.name); setIsDefault(active.is_default); setScales(active.scales.length ? active.scales : DEFAULT_SCALES);
    setOpen(true);
  }
  /**
   * S-8.5's escape hatch. A scheme whose bands are locked can still be changed
   * — by becoming a new scheme, leaving the graded one intact and reproducible.
   * The copy is unsaved until the operator presses Save, so it is a starting
   * point rather than a side effect of clicking a button.
   */
  function openCopy() {
    if (!active) return;
    setId("");
    setName(t(`${active.name} (নতুন সংস্করণ)`, `${active.name} (new version)`));
    setIsDefault(false);
    setScales(active.scales.length ? active.scales : DEFAULT_SCALES);
    setOpen(true);
  }
  const setScale = (i: number, k: keyof GradeScale, v: string) => setScales((p) => p.map((r, j) => j === i ? { ...r, [k]: k === "grade_letter" ? v : Number(v) } : r));

  /**
   * A scheme with an overlap, a hole, or a range that misses 0–100 produces
   * silently wrong grades for an entire cohort, because this table is the input
   * to `fn_process_exam_result` (SRA A-9.1). Nothing checked it before. Shown
   * live in the editor and enforced at save — the operator sees the defect while
   * they are still looking at the row that caused it.
   */
  const scaleProblems = useMemo(() => validateGradeScale(scales), [scales]);

  function save() {
    if (!name.trim()) { toast({ title: t("স্কিমের নাম আবশ্যক", "Scheme name required"), variant: "error" }); return; }
    if (!bandsLocked && scaleProblems.length > 0) {
      toast({ title: t("গ্রেড পরিসরে সমস্যা আছে", "Fix the grade ranges first"), variant: "error" });
      return;
    }
    /*
     * When the bands are locked, `scales` is omitted entirely rather than sent
     * unchanged. The server refuses ANY `scales` key on a scheme with processed
     * results — which is the correct rule for an untrusted caller, and would
     * otherwise block the operator from renaming a scheme they are allowed to
     * rename.
     */
    const payload = bandsLocked
      ? { id, name, is_default: isDefault }
      : { id: id || undefined, name, is_default: isDefault, scales };
    upsert.mutate(payload, {
      onSuccess: (savedId) => { toast({ title: t("গ্রেডিং স্কিম সংরক্ষিত", "Grading scheme saved"), variant: "success" }); setOpen(false); if (!id) setActiveId(savedId as string); },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
    });
  }
  function remove() {
    if (!delId || delImpact.data?.blocking) return;
    const target = delId; setDelId(null);
    del.mutate(target, {
      onSuccess: () => { toast({ title: t("মুছে ফেলা হয়েছে", "Deleted"), variant: "success" }); if (activeId === target) setActiveId(null); },
      onError: (e: unknown) => toast({ title: msg(e), variant: "error" }),
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex flex-wrap items-start gap-3">
        <PageHeader
          crumbs={[{ label: t("কোর সেটিংস", "Core Settings"), href: "/admin/core/basic-config" }, { label: t("বিষয় সেটিংস", "Subject Settings") }, { label: t("গ্রেডিং স্কিম", "Grading Scheme") }]}
          title={t("গ্রেডিং স্কিম", "Grading Scheme")}
          subtitle={t("GPA ৫.০ ভিত্তিক গ্রেড, নম্বর সীমা ও গ্রেড পয়েন্ট", "GPA-5 based grades, mark ranges & grade points")}
          className="flex-1"
        />
        <Button variant="primary" onClick={openNew}><Plus size={16} /> {t("নতুন স্কিম", "New scheme")}</Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-surface p-5 shadow-e1"><EmptyState icon={<Award size={22} />} title={t("কোনো স্কিম নেই", "No schemes yet")} /></div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2.5">
            {/* M-10: was a raw <select> with hand-written classes beside ten
                screens' worth of the shared control. */}
            <Select
              value={activeId ?? ""}
              onChange={(e) => setActiveId(e.target.value)}
              aria-label={t("স্কিম নির্বাচন", "Select scheme")}
              className="w-auto min-w-56"
              options={rows.map((r) => ({ value: r.id, label: t(`স্কিম: ${r.name}`, `Scheme: ${r.name}`) }))}
            />
            <div className="flex-1" />
            {active ? (
              <div className="flex items-center gap-2 rounded-lg bg-primary-subtle px-3 py-2 text-primary">
                <span className="text-meta">ⓘ</span>
                <span className="text-meta font-medium">{t(`পাস নম্বর: ${n(Number.isFinite(passMark) ? passMark : 0)} • সর্বোচ্চ GP: ${n(maxGp.toFixed(2))}`, `Pass mark: ${n(Number.isFinite(passMark) ? passMark : 0)} • Max GP: ${n(maxGp.toFixed(2))}`)}</span>
              </div>
            ) : null}
          </div>

          {active ? (
            <div className="flex flex-col gap-3">
              {/* Grade / range / GP / remark is a four-column lookup table and
                  is read as one — exactly the case <th scope> exists for. */}
              <Table minWidth={760}>
                <THead>
                  <TR>
                    <TH className="w-30">{t("গ্রেড", "Grade")}</TH>
                    <TH>{t("নম্বর সীমা", "Mark range")}</TH>
                    <TH className="w-50">{t("গ্রেড পয়েন্ট (GP)", "Grade Point (GP)")}</TH>
                    <TH>{t("মন্তব্য", "Remark")}</TH>
                    <TH className="w-11"><span className="sr-only">{t("অ্যাকশন", "Actions")}</span></TH>
                  </TR>
                </THead>
                <TBody>
                  {sortedScales.map((s, i) => (
                    <TR key={i}>
                      <TD><Badge tone={gradeTone(s.grade_letter)}>{s.grade_letter}</Badge></TD>
                      <TD className="text-sm text-text-secondary tnum">{n(s.min_marks)} – {n(s.max_marks)}</TD>
                      <TD className="text-sm font-semibold text-text-primary tnum">{n(s.gpa_point.toFixed(2))}</TD>
                      <TD className="text-meta text-text-secondary">{t(...(REMARKS[s.grade_letter] ?? ["—", "—"]))}</TD>
                      <TD className="text-right">
                        {/* S-8.1: the affordance says "edit this grade"; the
                            behaviour is "edit every grade". Per-band inline
                            editing is Phase 5 — until then the label is honest
                            about what the button does. */}
                        <button onClick={openEdit} aria-label={t("সব গ্রেড সম্পাদনা", "Edit all grades")} title={t("সব গ্রেড সম্পাদনা", "Edit all grades")} className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-sunken"><Pencil size={15} /></button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <div className="flex items-center justify-between rounded-xl border border-border-default bg-surface px-5 py-3">
                <span className="text-meta text-text-muted">{active.is_default ? <Badge tone="success">{t("ডিফল্ট স্কিম", "Default scheme")}</Badge> : null}</span>
                <button onClick={() => setDelId(active.id)} className="flex items-center gap-1.5 text-meta font-semibold text-danger-fg hover:underline"><Trash2 size={14} /> {t("স্কিম মুছুন", "Delete scheme")}</button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={id ? t("স্কিম সম্পাদনা", "Edit scheme") : t("নতুন গ্রেডিং স্কিম", "New grading scheme")}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t("বাতিল", "Cancel")}</Button><Button variant="primary" onClick={save} disabled={upsert.isPending || (!bandsLocked && scaleProblems.length > 0)}>{upsert.isPending ? t("সংরক্ষণ…", "Saving…") : t("সংরক্ষণ করুন", "Save")}</Button></>}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("স্কিমের নাম", "Scheme name")} required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="GPA 5.0" /></Field>
            {/* A-9: was a raw checkbox. S-8.3: setting a default displaces
                another one, and the screen never said which. */}
            <label className="flex items-center gap-2 self-end pb-2.5 text-meta text-text-secondary">
              <Checkbox checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              {t("ডিফল্ট স্কিম", "Default scheme")}
            </label>
          </div>
          {isDefault && currentDefault && currentDefault.id !== id ? (
            <p className="rounded-lg bg-warning-bg px-3 py-2 text-meta text-warning-fg">
              {t(
                `"${currentDefault.name}" আর ডিফল্ট থাকবে না।`,
                `"${currentDefault.name}" will stop being the default.`,
              )}
            </p>
          ) : null}

          {/*
            S-8.5. Rendered from the live count rather than a static warning, so
            it says how much is at stake and disappears the moment it does not
            apply.
          */}
          {bandsLocked ? (
            <div className="flex flex-col gap-2 rounded-xl border border-warning-fg/30 bg-warning-bg px-4 py-3 text-meta text-warning-fg">
              <p className="font-semibold">
                {t(
                  `এই স্কিম দিয়ে ইতিমধ্যে ${n(processed)}টি ফলাফল প্রসেস হয়েছে।`,
                  `This scheme has already graded ${n(processed)} results.`,
                )}
              </p>
              <p>
                {t(
                  "নম্বর সংরক্ষিত থাকে, কিন্তু গ্রেডের সীমা নয় — সীমা বদলালে আগে ছাপানো মার্কশিট আর মেলানো যাবে না। নাম ও ডিফল্ট বদলাতে পারবেন; সীমা বদলাতে হলে নতুন স্কিম তৈরি করুন।",
                  "Marks are stored; the bands that turn them into letters are not. Change the bands and a marksheet printed last term can no longer be reproduced. You can still rename it or change the default — to change the bands, copy it to a new scheme.",
                )}
              </p>
              <Button variant="secondary" onClick={openCopy} className="self-start">
                {t("নতুন স্কিমে কপি করুন", "Copy to a new scheme")}
              </Button>
            </div>
          ) : null}
          {/* The editable band grid. A <table> here is what makes the column
              header the accessible name of every input under it — the inputs
              carry no visible label of their own. */}
          <Table minWidth={560} className="text-xs">
            <THead>
              <TR>
                <TH className="w-24">{t("গ্রেড", "Grade")}</TH>
                <TH className="w-24">{t("GPA", "GPA")}</TH>
                <TH className="w-28">{t("সর্বনিম্ন", "Min")}</TH>
                <TH className="w-28">{t("সর্বোচ্চ", "Max")}</TH>
                <TH className="w-10"><span className="sr-only">{t("সরান", "Remove")}</span></TH>
              </TR>
            </THead>
            <TBody>
              {scales.map((s, i) => (
                <TR key={i}>
                  <TD className="px-3 py-1.5"><Input value={s.grade_letter} disabled={bandsLocked} onChange={(e) => setScale(i, "grade_letter", e.target.value)} aria-label={t("গ্রেড", "Grade")} className="h-8 font-latin" /></TD>
                  <TD className="px-3 py-1.5"><Input type="number" disabled={bandsLocked} value={String(s.gpa_point)} onChange={(e) => setScale(i, "gpa_point", e.target.value)} aria-label={t("GPA", "GPA")} className="h-8 font-latin" /></TD>
                  <TD className="px-3 py-1.5"><Input type="number" disabled={bandsLocked} value={String(s.min_marks)} onChange={(e) => setScale(i, "min_marks", e.target.value)} aria-label={t("সর্বনিম্ন নম্বর", "Min marks")} className="h-8 font-latin" /></TD>
                  <TD className="px-3 py-1.5"><Input type="number" disabled={bandsLocked} value={String(s.max_marks)} onChange={(e) => setScale(i, "max_marks", e.target.value)} aria-label={t("সর্বোচ্চ নম্বর", "Max marks")} className="h-8 font-latin" /></TD>
                  <TD className="px-3 py-1.5">
                    <button onClick={() => setScales((p) => p.filter((_, j) => j !== i))} disabled={bandsLocked} aria-label={t("এই গ্রেড সরান", "Remove this grade")} className="grid size-8 place-items-center rounded-md text-danger-fg hover:bg-sunken disabled:opacity-40"><X size={15} /></button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {!bandsLocked ? (
            <button onClick={() => setScales((p) => [...p, { grade_letter: "", gpa_point: 0, min_marks: 0, max_marks: 0 }])} className="flex items-center gap-1.5 self-start rounded-md px-1 py-0.5 text-meta font-semibold text-primary hover:underline"><Plus size={14} /> {t("গ্রেড যোগ করুন", "Add grade")}</button>
          ) : null}

          {!bandsLocked && scaleProblems.length > 0 ? (
            <div role="alert" className="flex flex-col gap-1 rounded-xl border border-danger-fg/30 bg-danger-bg px-4 py-3 text-meta text-danger-fg">
              <p className="font-semibold">{t("এই স্কিম দিয়ে ফলাফল প্রসেস করলে ভুল গ্রেড আসবে:", "Processing results with this scheme would produce wrong grades:")}</p>
              <ul className="list-disc pl-4">
                {scaleProblems.map((pr, i) => <li key={i}>{t(pr.bn, pr.en)}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      </Modal>

      {/* S-8.2 / M-16: "Delete scheme?" was the entire confirm for a record that
          `basic_config.grading_system_id` may point at and that may have graded
          a cohort. */}
      <ConfirmDialog
        open={!!delId}
        onClose={() => setDelId(null)}
        onConfirm={remove}
        tone="danger"
        title={t("স্কিম মুছবেন?", "Delete scheme?")}
        description={rows.find((r) => r.id === delId)?.name}
        confirmLabel={t("মুছুন", "Delete")}
        cancelLabel={t("বাতিল", "Cancel")}
        confirmDisabled={delImpact.isLoading || delImpact.data?.blocking}
        loading={del.isPending}
      >
        <ImpactPreview
          items={delImpact.data?.items ?? []}
          loading={delImpact.isLoading}
          label={impactLabel}
          emptyLabel={t("কিছুই এই স্কিমের উপর নির্ভর করছে না।", "Nothing depends on this scheme.")}
          blockedLabel={t(
            "এই স্কিম দিয়ে ফলাফল প্রসেস হয়েছে — মুছলে ছাপানো মার্কশিট আর তৈরি করা যাবে না।",
            "Results were graded with this scheme — deleting it makes those marksheets impossible to reproduce.",
          )}
        />
      </ConfirmDialog>
    </div>
  );
}
