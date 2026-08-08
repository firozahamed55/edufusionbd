"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Trash2, Pencil } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import {
  PageHeader, Field, Input, Button, Modal, ConfirmDialog, useToast,
  Skeleton, EmptyState, ErrorState, Badge, Checkbox, ImpactPreview,
} from "@/shared/ui";
import { useErrorMessage } from "@/shared/services/errors";
import { useCurrentYearId } from "@/shared/services/academicYear/hooks";
import { localDay } from "@/shared/lib/format";
import { monthGrid, calendarKeyTarget, type TermRow } from "../../logic/calendar";
import { calendarRangeSchema, termSchema } from "../../logic/schemas";
import { useCalendarImpact, useEntityImpact, useImpactLabel } from "../../logic/impact";
import {
  useCalendarRange, useSetCalendarRange, useClearCalendarRange,
  useTerms, useUpsertTerm, useDeleteTerm, useSetting,
} from "../../logic/hooks";

/**
 * Field errors for whichever schema a small local draft is being edited
 * against. These two dialogs hold plain `useState` drafts rather than
 * `useZodForm` values (the range editor is a nullable object, the term editor
 * is nested inside a panel), so this is the seam that gets them the same
 * messages the rest of the module now shows.
 */
function issuesOf(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  const out: Record<string, string> = {};
  if (result.success || !result.error) return out;
  for (const i of result.error.issues) {
    const key = String(i.path[0] ?? "");
    if (key && !out[key]) out[key] = i.message;
  }
  return out;
}

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

/** Sunday-first, indexed by `getUTCDay()` — for the spoken cell label, where an
 *  abbreviation is worse than the whole word. */
const DOW_FULL = [
  ["রবিবার", "Sunday"], ["সোমবার", "Monday"], ["মঙ্গলবার", "Tuesday"], ["বুধবার", "Wednesday"],
  ["বৃহস্পতিবার", "Thursday"], ["শুক্রবার", "Friday"], ["শনিবার", "Saturday"],
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
  /** The same cells in rows of seven — `role="row"` needs the grouping. */
  const weeks = useMemo(
    () => Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7)),
    [cells],
  );
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
  const [rangeTouched, setRangeTouched] = useState(false);

  /*
   * S-4.3: `to < from` was prevented by the `min` attribute alone, which a paste
   * or a scripted client walks straight past — and an inverted range marks
   * nothing while reporting success. The 366-day ceiling catches the other
   * common shape, a mistyped year.
   */
  const rangeErrors = useMemo(
    () => (editing ? issuesOf(calendarRangeSchema.safeParse(editing)) : {}),
    [editing],
  );
  const rangeError = (k: string) => (rangeTouched ? rangeErrors[k] : undefined);

  /** S-4.11: what a mark on these dates would sit on top of. */
  const rangeImpact = useCalendarImpact(editing?.from ?? null, editing?.to || (editing?.from ?? null));
  const impactLabel = useImpactLabel();

  function submitRange() {
    if (!editing) return;
    if (Object.keys(rangeErrors).length > 0) {
      setRangeTouched(true);
      return;
    }
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
          setRangeTouched(false);
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
  const nonWorking = (marks.data ?? []).filter((d) => !d.working);

  /* ------------------------------------------------------- keyboard (A-3) */

  /**
   * The one cell in the grid that is tabbable — the roving-tabindex half of
   * `role="grid"`. Tab reaches the calendar once; arrows move inside it. Before
   * this, reaching 28 April cost 28 Tab presses and leaving the month by
   * keyboard was impossible.
   */
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const wantFocus = useRef(false);
  const todayIso = localDay(today);

  const inMonth = (iso: string) => iso.slice(0, 7) === isoMonth(cursor.y, cursor.m);
  const activeDate =
    focusDate && inMonth(focusDate)
      ? focusDate
      : inMonth(todayIso)
        ? todayIso
        : `${isoMonth(cursor.y, cursor.m)}-01`;

  // Focus is moved in an effect rather than in the handler because crossing a
  // month boundary re-renders the whole grid first — the target button does not
  // exist yet at the moment the key is pressed.
  useEffect(() => {
    if (!wantFocus.current || !focusDate) return;
    wantFocus.current = false;
    document.getElementById(`cal-${focusDate}`)?.focus();
  }, [focusDate, cursor]);

  function onGridKeyDown(e: React.KeyboardEvent, iso: string) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = calendarKeyTarget(e.key, iso);
    if (!target) return;
    e.preventDefault();
    const [ty, tm] = [Number(target.slice(0, 4)), Number(target.slice(5, 7)) - 1];
    if (ty !== cursor.y || tm !== cursor.m) setCursor({ y: ty, m: tm });
    wantFocus.current = true;
    setFocusDate(target);
  }

  /**
   * What a screen reader says on each cell. The day number alone — "৫" — told a
   * non-sighted operator nothing: not the month, not the weekday, and not
   * whether the day was a holiday, which is the only information on the screen
   * that matters.
   */
  function dayLabel(iso: string, holiday: boolean, mark: { label: string | null } | undefined) {
    const d = new Date(`${iso}T00:00:00Z`);
    const dow = DOW_FULL[d.getUTCDay()];
    const month = MONTHS[d.getUTCMonth()];
    const date = `${n(d.getUTCDate())} ${t(month[0], month[1])} ${n(d.getUTCFullYear())}`;
    const weekday = t(dow[0], dow[1]);
    const state = mark?.label
      ? mark.label
      : holiday
        ? t("ছুটি", "holiday")
        : t("কর্মদিবস", "working day");
    const todaySuffix = iso === todayIso ? `, ${t("আজ", "today")}` : "";
    return `${date}, ${weekday} — ${state}${todaySuffix}`;
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex flex-wrap items-end gap-3">
        <PageHeader
          className="min-w-0 flex-1"
          crumbs={[
            { label: t("সেটিংস", "Settings"), href: "/admin/core" },
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
              A-3. This was a `div` of 42 buttons whose only accessible name was
              the day number — "৫" — with no month, no weekday, no holiday
              state, no `role="grid"` and no arrow navigation. It is a real grid
              now: one tab stop, arrows to move by day, PageUp/PageDown by
              month, and every cell says what it is.
            */}
            <div role="grid" aria-label={t(`${monthLabel} এর শিক্ষাপঞ্জি`, `Academic calendar for ${monthLabel}`)} className="flex flex-col gap-1.5">
              <div role="row" className="grid grid-cols-7 gap-1.5">
                {DOW.map(([bn, en]) => (
                  <div key={en} role="columnheader" className="pb-1 text-center text-micro font-semibold uppercase tracking-wide text-text-muted">
                    {t(bn, en)}
                  </div>
                ))}
              </div>
              {weeks.map((week, w) => (
                <div role="row" key={w} className="grid grid-cols-7 gap-1.5">
                  {week.map((date, i) => {
                    if (!date) return <div role="gridcell" key={`pad-${w}-${i}`} />;
                    const mark = byDate.get(date);
                    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
                    // An explicit row wins over the weekly holiday in both
                    // directions — a make-up class on a Friday is a working day.
                    const holiday = mark ? !mark.working : weekend.includes(dow);
                    const isToday = date === todayIso;
                    return (
                      <div role="gridcell" key={date}>
                        <button
                          id={`cal-${date}`}
                          type="button"
                          // Roving tabindex: exactly one cell is reachable by
                          // Tab; arrows move focus among the rest.
                          tabIndex={date === activeDate ? 0 : -1}
                          aria-label={dayLabel(date, holiday, mark)}
                          aria-current={isToday ? "date" : undefined}
                          onFocus={() => setFocusDate(date)}
                          onKeyDown={(e) => onGridKeyDown(e, date)}
                          onClick={() =>
                            setEditing({ from: date, to: date, label: mark?.label ?? "", working: mark ? mark.working : !holiday })
                          }
                          className={cn(
                            "flex min-h-16 w-full flex-col items-start gap-0.5 rounded-lg border p-2 text-left transition-colors",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                            holiday
                              ? "border-danger-fg/25 bg-danger-bg hover:border-danger-fg/50"
                              : "border-border-default bg-surface hover:bg-sunken",
                            isToday && "ring-2 ring-primary ring-offset-1 ring-offset-surface",
                          )}
                        >
                          {/* The visible number is decorative once the button
                              carries a full aria-label — announcing "৫" after
                              "5 April 2026, Sunday" is noise. */}
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
                // Every rule the RPC enforces, said before the round trip
                // rather than after it — including the unlabelled holiday it
                // has always refused.
                disabled={setRange.isPending || Object.keys(rangeErrors).length > 0}
              >
                {setRange.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("শুরুর তারিখ", "From")} required error={rangeError("from")} onBlur={() => setRangeTouched(true)}>
                <Input type="date" value={editing.from} onChange={(e) => setEditing((p) => p && { ...p, from: e.target.value })} />
              </Field>
              <Field
                label={t("শেষ তারিখ", "To")}
                hint={t("খালি রাখলে এক দিন", "Leave blank for a single day")}
                error={rangeError("to")}
                onBlur={() => setRangeTouched(true)}
              >
                <Input type="date" value={editing.to} min={editing.from} onChange={(e) => setEditing((p) => p && { ...p, to: e.target.value })} />
              </Field>
            </div>

            {/* S-4.11: marking a day a holiday does not delete the attendance
                already recorded on it — it makes that attendance unexplainable.
                Say so before, not in a support ticket after. */}
            {(rangeImpact.data?.items.length ?? 0) > 0 ? (
              <div className="rounded-lg bg-warning-bg px-3 py-2 text-warning-fg">
                <ImpactPreview
                  items={rangeImpact.data?.items ?? []}
                  loading={rangeImpact.isLoading}
                  label={impactLabel}
                  emptyLabel=""
                />
                <p className="mt-1 text-micro">
                  {t(
                    "এই তারিখগুলোতে ইতিমধ্যে উপস্থিতি নেওয়া হয়েছে — ছুটি চিহ্নিত করলে সেগুলো রয়ে যাবে কিন্তু হিসাবের বাইরে চলে যাবে।",
                    "Attendance is already recorded on these dates. Marking them a holiday leaves those rows in place but takes them out of every average.",
                  )}
                </p>
              </div>
            ) : null}
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
              error={rangeError("label")}
              onBlur={() => setRangeTouched(true)}
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
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState<TermRow | null>(null);

  const impactLabel = useImpactLabel();
  const delImpact = useEntityImpact("academic_term", confirming?.id ?? null);

  /** Which term "this is the current term" would displace (audit S-4.9). */
  const currentTerm = (terms.data ?? []).find((x) => x.is_current) ?? null;

  /*
   * S-4.9: term ranges were validated against nothing. Two terms could cover
   * the same day, which makes "which term is this mark in" unanswerable and
   * lets the marksheet pick one arbitrarily.
   */
  const errors = useMemo(() => {
    if (!draft) return {};
    return issuesOf(
      termSchema.safeParse({
        ...draft,
        others: (terms.data ?? [])
          .filter((x) => x.id !== draft.id)
          .map((x) => ({ start: x.start_date, end: x.end_date, name: x.name_en })),
      }),
    );
  }, [draft, terms.data]);
  const err = (k: string) => (touched ? errors[k] : undefined);

  function save() {
    if (!draft || !yearId) return;
    if (Object.keys(errors).length > 0) { setTouched(true); return; }
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
        onSuccess: () => { setDraft(null); setTouched(false); toast({ title: t("টার্ম সংরক্ষিত", "Term saved"), variant: "success" }); },
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
              <Button variant="primary" onClick={save} disabled={upsert.isPending || Object.keys(errors).length > 0}>
                {upsert.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("নাম (English)", "Name (English)")} required error={err("name_en")} onBlur={() => setTouched(true)}>
                <Input value={draft.name_en} placeholder="1st Term" onChange={(e) => setDraft((p) => p && { ...p, name_en: e.target.value })} />
              </Field>
              <Field label={t("নাম (বাংলা)", "Name (Bangla)")} error={err("name_bn")} onBlur={() => setTouched(true)}>
                <Input value={draft.name_bn} placeholder="১ম সাময়িক" onChange={(e) => setDraft((p) => p && { ...p, name_bn: e.target.value })} />
              </Field>
              <Field label={t("শুরু", "Starts")} error={err("start_date")} onBlur={() => setTouched(true)}>
                <Input type="date" value={draft.start_date} onChange={(e) => setDraft((p) => p && { ...p, start_date: e.target.value })} />
              </Field>
              <Field label={t("শেষ", "Ends")} error={err("end_date")} onBlur={() => setTouched(true)}>
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
            {/* S-4.9: exclusivity was enforced server-side with no UI signal
                about which term was about to stop being current. */}
            {draft.is_current && currentTerm && currentTerm.id !== draft.id ? (
              <p className="rounded-lg bg-warning-bg px-3 py-2 text-meta text-warning-fg">
                {t(
                  `“${currentTerm.name_en}” আর চলমান টার্ম থাকবে না।`,
                  `“${currentTerm.name_en}” will stop being the current term.`,
                )}
              </p>
            ) : null}
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
        confirmDisabled={delImpact.isLoading || delImpact.data?.blocking}
        onConfirm={() => {
          const target = confirming;
          if (!target || delImpact.data?.blocking) return;
          setConfirming(null);
          remove.mutate(target.id, {
            onSuccess: () => toast({ title: t("টার্ম মুছে ফেলা হয়েছে", "Term deleted"), variant: "success" }),
            onError: (e: unknown) => toast({ title: msg(e, { bn: "মোছা যায়নি", en: "Delete failed" }), variant: "error" }),
          });
        }}
      >
        <ImpactPreview
          items={delImpact.data?.items ?? []}
          loading={delImpact.isLoading}
          label={impactLabel}
          emptyLabel={t("কোনো পরীক্ষা বা চালান এই টার্মে নেই।", "No exam or invoice belongs to this term.")}
          blockedLabel={t(
            "এই টার্মে ফি চালান তৈরি হয়েছে — মুছলে সেগুলো কোন সময়সীমার তা আর বলা যাবে না।",
            "Fee invoices were raised against this term — deleting it leaves them with no billing period.",
          )}
        />
      </ConfirmDialog>
    </div>
  );
}
