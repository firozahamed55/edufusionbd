"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Plus, Pencil, CheckCircle2, Archive, AlertTriangle } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import {
  PageHeader, Field, Input, Button, Badge, Modal, ConfirmDialog, useToast, Skeleton,
  ErrorState, NoAccessState, Table, THead, TBody, TR, TH, TD, TableEmpty, Checkbox,
} from "@/shared/ui";
import { useErrorMessage, classifyError } from "@/shared/services/errors";
import {
  useAcademicYearRows, useUpsertAcademicYear, useSetCurrentAcademicYear, useCloseAcademicYear,
} from "../../logic/hooks";

const EMPTY = { id: "", year_label: "", start_date: "", end_date: "", is_current: false };

/**
 * Settings · Academic Year.
 *
 * THE HOLE THIS FILLS. `AcademicYearProvider` shipped, archived years render
 * read-only, and seven tables are year-scoped — `class_section`, `exam`,
 * `fee_invoice`, `migration_batch`, `student_enrollment`, `timetable_period`
 * and `academic_term`. What did not exist was any way to CREATE a year. A
 * school reaching the end of its first session had no path into its second one
 * except a direct SQL statement, which is a support ticket that ends with
 * somebody hand-editing production.
 *
 * WHY THE COUNTS ARE ON THE ROW. Switching the current year changes what every
 * screen in the product is reading and writing, and the old topbar switcher
 * offered a label and nothing else. "2025 — 9 sections, 268 enrolled, 4 exams"
 * is the difference between choosing a year and guessing at one.
 *
 * CLOSING IS NOT DELETING. A closed year keeps everything it owns and stops
 * being the default. The RPC refuses to close the last one, because an
 * institution with no current year has no default for any year-scoped query and
 * every dropdown in the product comes back empty with no explanation.
 */
export function AcademicYearScreen() {
  const { t, n } = useT();
  const msg = useErrorMessage();
  const toast = useToast();

  const years = useAcademicYearRows();
  const upsert = useUpsertAcademicYear();
  const setCurrent = useSetCurrentAcademicYear();
  const close = useCloseAcademicYear();

  const [draft, setDraft] = useState<typeof EMPTY | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);

  const rows = useMemo(() => years.data ?? [], [years.data]);
  const current = rows.find((r) => r.is_current) ?? null;
  const target = rows.find((r) => r.id === switching) ?? null;
  const closingRow = rows.find((r) => r.id === closing) ?? null;

  /** Client-side mirror of the RPC's rules, so the error arrives before the trip. */
  const draftError = useMemo(() => {
    if (!draft) return null;
    const label = draft.year_label.trim();
    if (!label) return t("বছরের নাম দিন", "Enter a label for the year");
    if (rows.some((r) => r.id !== draft.id && r.year_label.trim().toLowerCase() === label.toLowerCase())) {
      return t("এই নামে একটি বছর আছে", "A year with this label already exists");
    }
    if (draft.start_date && draft.end_date && draft.end_date <= draft.start_date) {
      return t("শেষ তারিখ শুরুর আগে", "The year ends before it starts");
    }
    if (draft.start_date && draft.end_date) {
      const clash = rows.find(
        (r) => r.id !== draft.id && r.start_date && r.end_date &&
          draft.start_date <= r.end_date && draft.end_date >= r.start_date,
      );
      // Overlapping years make "which year is this enrolment in" unanswerable.
      if (clash) return t(`“${clash.year_label}” এর সাথে তারিখ মিলে যাচ্ছে`, `Those dates overlap “${clash.year_label}”`);
    }
    return null;
  }, [draft, rows, t]);

  function save() {
    if (!draft || draftError) return;
    upsert.mutate(
      {
        id: draft.id || undefined,
        year_label: draft.year_label.trim(),
        start_date: draft.start_date || undefined,
        end_date: draft.end_date || undefined,
        is_current: draft.is_current,
      },
      {
        onSuccess: () => { setDraft(null); toast({ title: t("শিক্ষাবর্ষ সংরক্ষিত", "Academic year saved"), variant: "success" }); },
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
      },
    );
  }

  if (years.isError) {
    return classifyError(years.error) === "forbidden" ? (
      <NoAccessState
        title={t("এই পাতা দেখার অনুমতি নেই", "You do not have access to this page")}
        description={t("শিক্ষাবর্ষ ব্যবস্থাপনার জন্য সেটিংস অনুমতি প্রয়োজন।", "Managing academic years needs settings access.")}
        permission="core.settings"
      />
    ) : (
      <ErrorState title={t("শিক্ষাবর্ষ লোড করা যায়নি", "Could not load academic years")} description={msg(years.error)} />
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex flex-wrap items-start gap-3">
        <PageHeader
          crumbs={[{ label: t("সেটিংস", "Settings"), href: "/admin/core" }, { label: t("প্রতিষ্ঠান সেটিংস", "Institution Settings") }, { label: t("শিক্ষাবর্ষ", "Academic Year") }]}
          title={t("শিক্ষাবর্ষ", "Academic Year")}
          subtitle={t(
            "নতুন বর্ষ তৈরি, চলতি বর্ষ নির্ধারণ ও পুরোনো বর্ষ বন্ধ করা",
            "Create a year, choose the current one, and close a finished one",
          )}
          className="flex-1"
        />
        <Button variant="primary" onClick={() => setDraft({ ...EMPTY })}>
          <Plus size={16} /> {t("নতুন শিক্ষাবর্ষ", "New academic year")}
        </Button>
      </div>

      <Table minWidth={880}>
        <THead>
          <TR>
            <TH>{t("শিক্ষাবর্ষ", "Year")}</TH>
            <TH className="w-52">{t("সময়সীমা", "Period")}</TH>
            <TH className="w-24 text-right">{t("শাখা", "Sections")}</TH>
            <TH className="w-28 text-right">{t("ভর্তি", "Enrolled")}</TH>
            <TH className="w-24 text-right">{t("পরীক্ষা", "Exams")}</TH>
            <TH className="w-44"><span className="sr-only">{t("অ্যাকশন", "Actions")}</span></TH>
          </TR>
        </THead>
        <TBody>
          {years.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TR key={i}>{Array.from({ length: 6 }).map((__, j) => <TD key={j}><Skeleton className="h-5" /></TD>)}</TR>
            ))
          ) : rows.length === 0 ? (
            <TableEmpty colSpan={6} icon={<CalendarRange size={22} />} title={t("কোনো শিক্ষাবর্ষ নেই", "No academic year yet")} />
          ) : rows.map((r) => (
            <TR key={r.id}>
              <TD>
                <span className="flex items-center gap-2">
                  <span className="font-latin text-sm font-semibold text-text-primary">{r.year_label}</span>
                  {r.is_current ? <Badge tone="success" dot>{t("চলতি", "Current")}</Badge> : null}
                </span>
              </TD>
              <TD className="font-latin text-meta tabular-nums text-text-secondary">
                {r.start_date && r.end_date ? `${r.start_date} → ${r.end_date}` : "—"}
              </TD>
              <TD className="text-right text-meta tabular-nums text-text-secondary">{n(r.sections)}</TD>
              <TD className="text-right text-meta tabular-nums text-text-secondary">{n(r.enrollments)}</TD>
              <TD className="text-right text-meta tabular-nums text-text-secondary">{n(r.exams)}</TD>
              <TD>
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => setDraft({
                      id: r.id, year_label: r.year_label,
                      start_date: r.start_date ?? "", end_date: r.end_date ?? "", is_current: r.is_current,
                    })}
                    aria-label={t(`${r.year_label} সম্পাদনা`, `Edit ${r.year_label}`)}
                    className="grid size-8 place-items-center rounded-md text-text-muted hover:bg-sunken"
                  >
                    <Pencil size={15} />
                  </button>
                  {!r.is_current ? (
                    <Button variant="ghost" className="h-8 px-2" onClick={() => setSwitching(r.id)}>
                      <CheckCircle2 size={15} /> {t("চলতি করুন", "Make current")}
                    </Button>
                  ) : (
                    <Button variant="ghost" className="h-8 px-2" onClick={() => setClosing(r.id)}>
                      <Archive size={15} /> {t("বন্ধ করুন", "Close")}
                    </Button>
                  )}
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {draft ? (
        <Modal
          open
          onClose={() => setDraft(null)}
          title={draft.id ? t("শিক্ষাবর্ষ সম্পাদনা", "Edit academic year") : t("নতুন শিক্ষাবর্ষ", "New academic year")}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDraft(null)}>{t("বাতিল", "Cancel")}</Button>
              <Button variant="primary" onClick={save} disabled={upsert.isPending || !!draftError}>
                {upsert.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field
              label={t("বছরের নাম", "Year label")}
              required
              hint={t("যেমন ২০২৬ বা ২০২৬-২৭", "e.g. 2026 or 2026-27")}
              error={draftError ?? undefined}
            >
              <Input
                value={draft.year_label}
                onChange={(e) => setDraft((p) => p && { ...p, year_label: e.target.value })}
                className="font-latin"
                placeholder="2027"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("শুরু", "Starts")}>
                <Input type="date" value={draft.start_date} onChange={(e) => setDraft((p) => p && { ...p, start_date: e.target.value })} />
              </Field>
              <Field label={t("শেষ", "Ends")}>
                <Input type="date" value={draft.end_date} min={draft.start_date || undefined} onChange={(e) => setDraft((p) => p && { ...p, end_date: e.target.value })} />
              </Field>
            </div>
            {!draft.is_current ? (
              <label className="flex items-center gap-2 text-meta text-text-secondary">
                <Checkbox checked={draft.is_current} onChange={(e) => setDraft((p) => p && { ...p, is_current: e.target.checked })} />
                {t("সংরক্ষণের পর এটিকেই চলতি বর্ষ করুন", "Make this the current year on save")}
              </label>
            ) : null}
            {draft.is_current && current && current.id !== draft.id ? (
              <p className="rounded-lg bg-warning-bg px-3 py-2 text-meta text-warning-fg">
                {t(`“${current.year_label}” আর চলতি বর্ষ থাকবে না।`, `“${current.year_label}” will stop being the current year.`)}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {/*
        Switching the current year changes what every screen in the product
        reads and writes. That deserves a sentence, not a silent flip.
      */}
      <ConfirmDialog
        open={!!switching}
        onClose={() => setSwitching(null)}
        onConfirm={() => {
          const id = switching;
          setSwitching(null);
          if (!id) return;
          setCurrent.mutate(id, {
            onSuccess: () => toast({ title: t("চলতি শিক্ষাবর্ষ পরিবর্তিত", "Current academic year changed"), variant: "success" }),
            onError: (e: unknown) => toast({ title: msg(e), variant: "error" }),
          });
        }}
        title={t("চলতি শিক্ষাবর্ষ বদলাবেন?", "Change the current academic year?")}
        description={t(
          `“${target?.year_label ?? ""}” চলতি বর্ষ হবে। এরপর ভর্তি, উপস্থিতি, পরীক্ষা ও ফি — সব এই বর্ষে লেখা হবে।`,
          `“${target?.year_label ?? ""}” becomes current. Enrolment, attendance, exams and fees will all be written against it from then on.`,
        )}
        confirmLabel={t("চলতি করুন", "Make current")}
        cancelLabel={t("বাতিল", "Cancel")}
        loading={setCurrent.isPending}
      />

      <ConfirmDialog
        open={!!closing}
        onClose={() => setClosing(null)}
        onConfirm={() => {
          const id = closing;
          setClosing(null);
          if (!id) return;
          close.mutate(id, {
            onSuccess: () => toast({ title: t("শিক্ষাবর্ষ বন্ধ হয়েছে", "Academic year closed"), variant: "success" }),
            onError: (e: unknown) => toast({ title: msg(e), variant: "error" }),
          });
        }}
        tone="danger"
        title={t("শিক্ষাবর্ষ বন্ধ করবেন?", "Close this academic year?")}
        confirmLabel={t("বন্ধ করুন", "Close")}
        cancelLabel={t("বাতিল", "Cancel")}
        loading={close.isPending}
      >
        <div className="flex flex-col gap-2 text-meta text-text-secondary">
          <p>
            {t(
              "কোনো তথ্য মুছবে না — বর্ষটি শুধু আর ডিফল্ট থাকবে না এবং এর তথ্য কেবল পড়া যাবে।",
              "Nothing is deleted — the year simply stops being the default, and its data becomes read-only.",
            )}
          </p>
          {closingRow ? (
            <p className="text-text-muted">
              {t(
                `এতে ${n(closingRow.sections)}টি শাখা, ${n(closingRow.enrollments)} জন ভর্তি ও ${n(closingRow.exams)}টি পরীক্ষা আছে।`,
                `It holds ${closingRow.sections} sections, ${closingRow.enrollments} enrolments and ${closingRow.exams} exams.`,
              )}
            </p>
          ) : null}
          <p className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-warning-fg">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            {t(
              "বন্ধ করার আগে পরের বর্ষটি তৈরি করে চলতি করুন — নইলে প্রতিষ্ঠানের কোনো চলতি বর্ষ থাকবে না।",
              "Create the next year and make it current first — otherwise the institution has no current year at all.",
            )}
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
