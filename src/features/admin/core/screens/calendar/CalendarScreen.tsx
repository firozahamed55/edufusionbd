"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Trash2, Pencil } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import {
  PageHeader, Field, Input, Button, Modal, ConfirmDialog, useToast,
  Skeleton, EmptyState, ErrorState, Badge, Checkbox,
} from "@/shared/ui";
import { useErrorMessage } from "@/shared/services/errors";
import { useCurrentYearId } from "@/shared/services/academicYear/hooks";
import { localDay } from "@/shared/lib/format";
import { useGridNavigation } from "@/shared/lib/useGridNavigation";
import { monthGrid, type TermRow } from "../../logic/calendar";
import {
  useCalendarRange, useSetCalendarRange, useClearCalendarRange,
  useTerms, useUpsertTerm, useDeleteTerm, useSetting,
} from "../../logic/hooks";

const MONTHS = [
  ["জানুয়ারি", "January"], ["ফেব্রুয়ারি", "February"], ["মার্চ", "March"], ["এপ্রিল", "April"],
  ["মে", "May"], ["জুন", "June"], ["জুলাই", "July"], ["আগস্ট", "August"],
  ["সেপ্টেম্বর", "September"], ["অক্টোবর", "October"], ["নভেম্বর", "November"], ["ডিসেম্বর", "December"],
] as const;

/** Saturday-first, matching `monthGrid`. */
const DOW = [
  ["শনি", "Sat"], ["রবি", "Sun"], ["সোম", "Mon"], ["মঙ্গল", "Tue"],
  ["বুধ", "Wed"], ["বৃহঃ", "Thu"], ["শুক্র", "Fri"],
] as const;

/**
 * The same seven days spelled out. The column headers are abbreviated because
 * a 7-column grid has no room; an accessible name has all the room it needs,
 * and "বৃহঃ" is not a word a screen reader can pronounce.
 */
const DOW_FULL = [
  ["শনিবার", "Saturday"], ["রবিবার", "Sunday"], ["সোমবার", "Monday"], ["মঙ্গলবার", "Tuesday"],
  ["বুধবার", "Wednesday"], ["বৃহস্পতিবার", "Thursday"], ["শুক্রবার", "Friday"],
] as const;

/**
 * The same mapping `fn_calendar_day` applies to `basic_config.weekend`, so the
 * grid can tint the weekly holiday without asking the server 30 times for a
 * month. The server remains the authority — this only paints.
 */
function weekendDows(token: unknown): number[] {
  switch (token) {
    case "fri_sat": return [5, 6];
    case "sat_sun": return [6, 0];
    default: return [5];
  }
}

const isoMonth = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

/**
 * Academic Calendar (SRA A-4 item 3 · portfolio addition #7).
 *
 * "Weekends, government holidays and institution holidays are not modelled.
 * Attendance can be taken on Eid; the 30-day average on the dashboard is
 * diluted by non-teaching days; and there is no academic-calendar screen
 * anywhere in the product."
 *
 * A RANGE IS THE UNIT OF WORK, not a day. A school declares "Eid holidays,
 * 8–14 April" — clicking seven cells is how an operator gets six of them right
 * and one wrong. Single-day editing exists too, because a make-up class on a
 * Friday is one date.
 */
export function CalendarScreen() {
  const { t, n } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const yearId = useCurrentYearId();

  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const cells = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const dates = cells.filter(Boolean) as string[];
  const from = dates[0] ?? `${isoMonth(cursor.y, cursor.m)}-01`;
  const to = dates[dates.length - 1] ?? from;

  const marks = useCalendarRange(from, to);
  const config = useSetting("basic_config", "core");
  const weekend = weekendDows(config.data?.value.weekend);

  const setRange = useSetCalendarRange();
  const clearRange = useClearCalendarRange();

  const byDate = useMemo(
    () => new Map((marks.data ?? []).map((d) => [d.date, d])),
    [marks.data],
  );

  /** The range editor. Opened blank from the toolbar, or pre-filled by a cell. */
  const [editing, setEditing] = useState<{ from: string; to: string; label: string; working: boolean } | null>(null);

  function submitRange() {
    if (!editing) return;
    setRange.mutate(
      {
        from: editing.from,
        to: editing.to || editing.from,
        is_working_day: editing.working,
        label: editing.label.trim() || undefined,
        academic_year_id: yearId,
      },
      {
        onSuccess: (count) => {
          setEditing(null);
          toast({ title: t(`${n(Number(count))} দিন চিহ্নিত হয়েছে`, `${Number(count)} days marked`), variant: "success" });
        },
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
      },
    );
  }

  function clearOne(date: string) {
    clearRange.mutate(
      { from: date, to: date },
      {
        onSuccess: () => toast({ title: t("চিহ্ন সরানো হয়েছে", "Marking removed"), variant: "success" }),
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সরানো যায়নি", en: "Could not clear" }), variant: "error" }),
      },
    );
  }

  const monthLabel = `${t(MONTHS[cursor.m][0], MONTHS[cursor.m][1])} ${n(cursor.y)}`;

  /* ------------------------------------------------- A-3: the grid's keyboard */

  /** `monthGrid` is flat; a `role="grid"` needs its rows to be rows. */
  const weeks = useMemo(() => {
    const out: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [cells]);

  const firstDate = useMemo(() => cells.find((d): d is string => d !== null) ?? null, [cells]);
  /**
   * The one cell that is tabbable. Today when today is in view, otherwise the
   * first of the month — so arriving at the grid lands somewhere meaningful
   * rather than on the 1st of a month the operator navigated away from.
   */
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const todayIso = localDay(today);
    setActiveDate(cells.includes(todayIso) ? todayIso : firstDate);
    // `cells` changes exactly when the month does, which is when the roving
    // anchor must be re-chosen.
  }, [cells, firstDate, today]);

  const grid = useGridNavigation({ rows: weeks.length, cols: 7 });

  const focusActive = useCallback(() => {
    if (!activeDate) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${activeDate}"]`)?.focus();
  }, [activeDate]);

  /**
   * The keys `useGridNavigation` does not cover, because they only make sense
   * for a date grid: Home/End are the row's ends, and PageUp/PageDown are the
   * month — the movement that saves an operator planning a year the most time.
   *
   * Returns true when it handled the key, so the caller can skip the hook.
   */
  const onGridKey = useCallback(
    (e: React.KeyboardEvent, rowIndex: number, colIndex: number): boolean => {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      const row = weeks[rowIndex] ?? [];
      const focusIn = (list: (string | null)[], from: "start" | "end") => {
        const found = from === "start"
          ? list.find((d): d is string => d !== null)
          : [...list].reverse().find((d): d is string => d !== null);
        if (!found) return false;
        setActiveDate(found);
        gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${found}"]`)?.focus();
        return true;
      };
      switch (e.key) {
        case "Home":
          e.preventDefault();
          return focusIn(row, "start");
        case "End":
          e.preventDefault();
          return focusIn(row, "end");
        case "PageUp":
          e.preventDefault();
          setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { ...c, m: c.m - 1 }));
          return true;
        case "PageDown":
          e.preventDefault();
          setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { ...c, m: c.m + 1 }));
          return true;
        default:
          // Column index is unused on this path but is part of the signature
          // the caller already has; keeping it makes the two handlers read the
          // same way at the call site.
          void colIndex;
          return false;
      }
    },
    [weeks],
  );
  const nonWorking = (marks.data ?? []).filter((d) => !d.working);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex flex-wrap items-end gap-3">
        <PageHeader
          className="min-w-0 flex-1"
          crumbs={[
            { label: t("কোর সেটিংস", "Core Settings"), href: "/admin/core/basic-config" },
            { label: t("প্রতিষ্ঠান সেটিংস", "Institution Settings") },
            { label: t("শিক্ষাপঞ্জি", "Academic Calendar") },
          ]}
          title={t("শিক্ষাপঞ্জি", "Academic Calendar")}
          subtitle={t(
            "ছুটি ও কর্মদিবস নির্ধারণ করুন — উপস্থিতি ও সব পরিসংখ্যান এই পঞ্জি মেনে চলে",
            "Set holidays and working days — attendance and every statistic follow this calendar",
          )}
        />
        <Button
          variant="primary"
          onClick={() => setEditing({ from: localDay(new Date()), to: "", label: "", working: false })}
        >
          <Plus size={16} /> {t("ছুটি যোগ করুন", "Add a holiday")}
        </Button>
      </div>

      {/* ------------------------------------------------------------- month */}
      <div className="rounded-2xl border border-border-default bg-surface shadow-e1">
        <div className="flex items-center gap-2 border-b border-border-default px-5 py-3.5">
          <button
            type="button"
            aria-label={t("আগের মাস", "Previous month")}
            onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { ...c, m: c.m - 1 }))}
            className="grid size-8 place-items-center rounded-lg border border-border-default text-text-secondary hover:bg-sunken"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="min-w-40 text-center text-body font-semibold text-text-primary">{monthLabel}</p>
          <button
            type="button"
            aria-label={t("পরের মাস", "Next month")}
            onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { ...c, m: c.m + 1 }))}
            className="grid size-8 place-items-center rounded-lg border border-border-default text-text-secondary hover:bg-sunken"
          >
            <ChevronRight size={16} />
          </button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            className="h-8 px-3"
            onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })}
          >
            {t("আজ", "Today")}
          </Button>
        </div>

        {marks.isError ? (
          <ErrorState title={t("পঞ্জি লোড করা যায়নি", "Could not load the calendar")} description={msg(marks.error)} />
        ) : (
          <div className="p-4">
            {/*
              A-3 / WCAG 1.3.1, 2.1.1, 2.4.6.
              What was here: a plain `div` grid of 42 buttons, each named by its
              day number alone ("৫"). No month, no weekday, no holiday state,
              no relationship between a cell and its column header — and no
              arrow keys, so reaching 28 April was 28 Tab presses.

              Now a real `role="grid"`: column headers the cells are associated
              with, one tab stop for the whole month (roving `tabindex`, the
              pattern for a composite widget), arrows to move, Home/End for the
              row, PageUp/PageDown for the month, and a full accessible name
              per day.

              `useGridNavigation` supplies the arrows and the ref map. It
              deliberately does NOT do roving tabindex — its own header explains
              why, and the reason is sound for the two MARKS-ENTRY grids it was
              built for, where cells are real inputs and Tab already means
              something correct. This grid is buttons, where the composite
              pattern is right and Tab-per-cell is the failure. So the roving
              part lives here, over the hook's movement, rather than being
              pushed into a hook whose other two callers would be made worse
              by it.
            */}
            <div
              role="grid"
              ref={gridRef}
              aria-label={t(`${monthLabel} এর পঞ্জিকা`, `Calendar for ${monthLabel}`)}
              className="grid grid-cols-7 gap-1.5"
              /* One tab stop in, one out: focus lands on the active cell. */
              onFocus={(e) => { if (e.target === e.currentTarget) focusActive(); }}
            >
              <div role="row" className="col-span-7 grid grid-cols-7 gap-1.5">
                {DOW.map(([bn, en]) => (
                  <div
                    key={en}
                    role="columnheader"
                    className="pb-1 text-center text-micro font-semibold uppercase tracking-wide text-text-muted"
                  >
                    {t(bn, en)}
                  </div>
                ))}
              </div>
              {weeks.map((week, rowIndex) => (
                <div role="row" key={`row-${rowIndex}`} className="col-span-7 grid grid-cols-7 gap-1.5">
                  {week.map((date, colIndex) => {
                    if (!date) return <div role="gridcell" key={`pad-${rowIndex}-${colIndex}`} />;
                    const mark = byDate.get(date);
                    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
                    // An explicit row wins over the weekly holiday in both
                    // directions — a make-up class on a Friday is a working day.
                    const holiday = mark ? !mark.working : weekend.includes(dow);
                    const isToday = date === localDay(today);
                    const active = date === activeDate;
                    return (
                      <div role="gridcell" key={date}>
                        <button
                          type="button"
                          ref={grid.register(rowIndex, colIndex)}
                          data-day={date}
                          /* Roving: exactly one cell is tabbable at a time. */
                          tabIndex={active ? 0 : -1}
                          aria-current={isToday ? "date" : undefined}
                          aria-label={dayLabel({ date, dow, holiday, label: mark?.label ?? null, isToday, t, n })}
                          onFocus={() => setActiveDate(date)}
                          onKeyDown={(e) => {
                            if (onGridKey(e, rowIndex, colIndex)) return;
                            grid.onKeyDown(rowIndex, colIndex)(e);
                          }}
                          onClick={() =>
                            setEditing({ from: date, to: date, label: mark?.label ?? "", working: mark ? mark.working : !holiday })
                          }
                          className={cn(
                            "flex min-h-16 w-full flex-col items-start gap-0.5 rounded-lg border p-2 text-left transition-colors",
                            holiday
                              ? "border-danger-fg/25 bg-danger-bg hover:border-danger-fg/50"
                              : "border-border-default bg-surface hover:bg-sunken",
                            isToday && "ring-2 ring-primary ring-offset-1 ring-offset-surface",
                          )}
                        >
                          {/* The visible number is decorative now: the button's
                              aria-label carries the whole answer, and reading
                              both would announce the date twice. */}
                          <span aria-hidden className={cn("text-meta font-semibold tnum", holiday ? "text-danger-fg" : "text-text-primary")}>
                            {n(Number(date.slice(8)))}
                          </span>
                          {mark?.label ? (
                            <span aria-hidden className="line-clamp-2 text-micro leading-tight text-text-secondary">{mark.label}</span>
                          ) : holiday ? (
                            <span aria-hidden className="text-micro text-text-muted">{t("সাপ্তাহিক ছুটি", "Weekly holiday")}</span>
                          ) : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {marks.isLoading ? <Skeleton className="mt-3 h-4 w-40" /> : (
              <p className="mt-3 text-micro text-text-muted">
                {t(
                  `এই মাসে ${n(nonWorking.length)} দিন ছুটি চিহ্নিত · কোনো দিনে ক্লিক করে পরিবর্তন করুন`,
                  `${nonWorking.length} days marked as holiday this month · click any day to change it`,
                )}
              </p>
            )}
          </div>
        )}
      </div>

      <TermsPanel yearId={yearId} />

      {editing ? (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={t("দিন বা সময়সীমা চিহ্নিত করুন", "Mark a day or a range")}
          description={t(
            "একটি তারিখ দিলে সেই দিন, দুটি দিলে পুরো সময়সীমা চিহ্নিত হবে।",
            "One date marks that day; two mark the whole range.",
          )}
          footer={
            <>
              {byDate.has(editing.from) ? (
                <Button
                  variant="ghost"
                  onClick={() => { clearOne(editing.from); setEditing(null); }}
                  disabled={clearRange.isPending}
                >
                  <Trash2 size={15} /> {t("চিহ্ন সরান", "Clear")}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => setEditing(null)}>{t("বাতিল", "Cancel")}</Button>
              <Button
                variant="primary"
                onClick={submitRange}
                disabled={
                  !editing.from ||
                  setRange.isPending ||
                  // The RPC refuses an unlabelled holiday; say so before the
                  // round trip rather than after it.
                  (!editing.working && !editing.label.trim())
                }
              >
                {setRange.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("শুরুর তারিখ", "From")} required>
                <Input type="date" value={editing.from} onChange={(e) => setEditing((p) => p && { ...p, from: e.target.value })} />
              </Field>
              <Field label={t("শেষ তারিখ", "To")} hint={t("খালি রাখলে এক দিন", "Leave blank for a single day")}>
                <Input type="date" value={editing.to} min={editing.from} onChange={(e) => setEditing((p) => p && { ...p, to: e.target.value })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-meta text-text-secondary">
              <Checkbox
                checked={editing.working}
                onChange={(e) => setEditing((p) => p && { ...p, working: e.target.checked })}
              />
              {t("এটি একটি কর্মদিবস", "This is a working day")}
            </label>
            <Field
              label={editing.working ? t("বিবরণ", "Note") : t("ছুটির কারণ", "Holiday name")}
              required={!editing.working}
              hint={
                editing.working
                  ? t("যেমন — সাপ্তাহিক ছুটির দিনে অতিরিক্ত ক্লাস", "e.g. make-up class on a weekly holiday")
                  : t("রেজিস্টারে ব্যাখ্যাহীন ফাঁক পরিদর্শকের প্রশ্ন", "An unexplained gap in the register is what an inspector asks about")
              }
            >
              <Input
                value={editing.label}
                placeholder={editing.working ? t("অতিরিক্ত ক্লাস", "Make-up class") : t("ঈদুল ফিতরের ছুটি", "Eid-ul-Fitr holidays")}
                onChange={(e) => setEditing((p) => p && { ...p, label: e.target.value })}
              />
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ terms */

const EMPTY_TERM = { id: "", name_en: "", name_bn: "", start_date: "", end_date: "", is_current: false };

/**
 * `academic_term` shipped as a table with no writer and no reader. Terms are
 * what a marksheet means by "1st Term" and what a fee schedule bills against,
 * so exactly one may be current — the RPC enforces it, this only says so.
 */
function TermsPanel({ yearId }: { yearId: string | undefined }) {
  const { t, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();

  const terms = useTerms(yearId);
  const upsert = useUpsertTerm();
  const remove = useDeleteTerm();

  const [draft, setDraft] = useState<typeof EMPTY_TERM | null>(null);
  const [confirming, setConfirming] = useState<TermRow | null>(null);

  function save() {
    if (!draft || !yearId) return;
    upsert.mutate(
      {
        id: draft.id || undefined,
        academic_year_id: yearId,
        name_en: draft.name_en.trim(),
        name_bn: draft.name_bn.trim() || undefined,
        start_date: draft.start_date || undefined,
        end_date: draft.end_date || undefined,
        is_current: draft.is_current,
      },
      {
        onSuccess: () => { setDraft(null); toast({ title: t("টার্ম সংরক্ষিত", "Term saved"), variant: "success" }); },
        onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
      },
    );
  }

  return (
    <div className="rounded-2xl border border-border-default bg-surface shadow-e1">
      <div className="flex items-center gap-3 border-b border-border-default px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-text-primary">{t("শিক্ষাবর্ষের টার্ম", "Terms of the academic year")}</p>
          <p className="text-micro text-text-muted">
            {t("মার্কশিট ও ফি সময়সীমা এই টার্মগুলো ধরে চলে", "Marksheets and fee schedules run against these terms")}
          </p>
        </div>
        <Button variant="secondary" className="h-8 px-3" onClick={() => setDraft({ ...EMPTY_TERM })} disabled={!yearId}>
          <Plus size={15} /> {t("টার্ম", "Term")}
        </Button>
      </div>

      {terms.isLoading ? (
        <div className="flex flex-col gap-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : terms.isError ? (
        <ErrorState title={t("টার্ম লোড করা যায়নি", "Could not load terms")} description={msg(terms.error)} />
      ) : (terms.data ?? []).length === 0 ? (
        <EmptyState icon={<CalendarDays size={22} />} title={t("এখনও কোনো টার্ম নেই", "No terms yet")} />
      ) : (
        <ul className="divide-y divide-border-default">
          {(terms.data ?? []).map((term) => (
            <li key={term.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  {(isBn ? term.name_bn : term.name_en) || term.name_en}
                  {term.is_current ? <Badge tone="success" dot>{t("চলমান", "Current")}</Badge> : null}
                </p>
                <p className="text-micro text-text-muted tnum">
                  {term.start_date || "—"} → {term.end_date || "—"}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("সম্পাদনা", "Edit")}
                onClick={() => setDraft({
                  id: term.id, name_en: term.name_en, name_bn: term.name_bn ?? "",
                  start_date: term.start_date ?? "", end_date: term.end_date ?? "", is_current: term.is_current,
                })}
                className="grid size-8 place-items-center rounded-lg text-text-secondary hover:bg-sunken"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                aria-label={t("মুছুন", "Delete")}
                onClick={() => setConfirming(term)}
                className="grid size-8 place-items-center rounded-lg text-danger-fg hover:bg-danger-bg"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <Modal
          open
          onClose={() => setDraft(null)}
          title={draft.id ? t("টার্ম সম্পাদনা", "Edit term") : t("নতুন টার্ম", "New term")}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDraft(null)}>{t("বাতিল", "Cancel")}</Button>
              <Button variant="primary" onClick={save} disabled={!draft.name_en.trim() || upsert.isPending}>
                {upsert.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("নাম (English)", "Name (English)")} required>
                <Input value={draft.name_en} placeholder="1st Term" onChange={(e) => setDraft((p) => p && { ...p, name_en: e.target.value })} />
              </Field>
              <Field label={t("নাম (বাংলা)", "Name (Bangla)")}>
                <Input value={draft.name_bn} placeholder="১ম সাময়িক" onChange={(e) => setDraft((p) => p && { ...p, name_bn: e.target.value })} />
              </Field>
              <Field label={t("শুরু", "Starts")}>
                <Input type="date" value={draft.start_date} onChange={(e) => setDraft((p) => p && { ...p, start_date: e.target.value })} />
              </Field>
              <Field label={t("শেষ", "Ends")}>
                <Input type="date" value={draft.end_date} min={draft.start_date || undefined} onChange={(e) => setDraft((p) => p && { ...p, end_date: e.target.value })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-meta text-text-secondary">
              <Checkbox
                checked={draft.is_current}
                onChange={(e) => setDraft((p) => p && { ...p, is_current: e.target.checked })}
              />
              {t("এটিই চলমান টার্ম", "This is the current term")}
            </label>
          </div>
        </Modal>
      ) : null}

      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title={t("টার্ম মুছে ফেলবেন?", "Delete this term?")}
        description={t(
          `“${confirming?.name_en ?? ""}” মুছে গেলে এই টার্মের নামে তৈরি রিপোর্টে আর মিল থাকবে না।`,
          `Reports written against “${confirming?.name_en ?? ""}” will no longer match.`,
        )}
        confirmLabel={t("মুছুন", "Delete")}
        tone="danger"
        onConfirm={() => {
          const target = confirming;
          setConfirming(null);
          if (!target) return;
          remove.mutate(target.id, {
            onSuccess: () => toast({ title: t("টার্ম মুছে ফেলা হয়েছে", "Term deleted"), variant: "success" }),
            onError: (e: unknown) => toast({ title: msg(e, { bn: "মোছা যায়নি", en: "Delete failed" }), variant: "error" }),
          });
        }}
      />
    </div>
  );
}

/**
 * The whole answer for one day, as one accessible name (audit A-3, WCAG 2.4.6).
 *
 * The old name was the day number alone: "৫". A screen-reader user tabbing the
 * month heard forty-two numbers and had to hold the month, the weekday and the
 * holiday state in their head to know what any of them meant. The audit's own
 * example of what it should say is
 * "১৫ এপ্রিল ২০২৬, বৃহস্পতিবার — ঈদুল ফিতরের ছুটি", and that is what this builds.
 *
 * Order is date, weekday, state, label — the same order the eye reads the cell,
 * and the most identifying part first so a user scanning by voice can stop
 * early.
 */
function dayLabel({
  date,
  dow,
  holiday,
  label,
  isToday,
  t,
  n,
}: {
  date: string;
  /** 0 = Sunday, matching `Date#getUTCDay`. */
  dow: number;
  holiday: boolean;
  label: string | null;
  isToday: boolean;
  t: (bn: string, en: string) => string;
  n: (value: string | number) => string;
}): string {
  const [year, month, dayOfMonth] = date.split("-");
  const monthIndex = Number(month) - 1;
  const monthName = t(MONTHS[monthIndex][0], MONTHS[monthIndex][1]);
  // `DOW` is Saturday-first to match the grid's columns; `getUTCDay` is
  // Sunday-first. Index across rather than reordering either.
  const weekday = t(DOW_FULL[(dow + 1) % 7][0], DOW_FULL[(dow + 1) % 7][1]);

  const parts = [
    `${n(Number(dayOfMonth))} ${monthName} ${n(year)}, ${weekday}`,
    holiday ? t("ছুটি", "Holiday") : t("কর্মদিবস", "Working day"),
  ];
  if (label) parts.push(label);
  if (isToday) parts.push(t("আজ", "Today"));
  return parts.join(" — ");
}
