"use client";

import { useRef, useState } from "react";
import { CalendarRange, Check, ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { useFocusTrap } from "@/shared/ui";
import { useAcademicYear } from "@/shared/services/academicYear/context";

/**
 * The academic-year switcher (audit T-1 / B-1). Until this existed the year an
 * operator was writing to was invisible and unchangeable — the single most
 * important piece of state in a school ERP, resolved implicitly by 21 files.
 *
 * A non-current selection tints amber and drives `isReadOnly` app-wide, so the
 * Dec–Jan rollover can't silently write into the wrong year.
 */
export function AcademicYearSelector() {
  const { t } = useT();
  const { years, year, yearId, currentYearId, isReadOnly, setYearId } = useAcademicYear();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open, () => setOpen(false), { lockScroll: false });

  if (!year) return null;

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("শিক্ষাবর্ষ নির্বাচন", "Select academic year")}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-meta font-semibold transition-colors",
          isReadOnly
            ? "border-warning-fg/40 bg-warning-bg text-warning-fg"
            : "border-border-control text-text-secondary hover:bg-sunken",
        )}
      >
        <CalendarRange size={15} className="shrink-0" />
        <span className="tnum">{year.year_label}</span>
        <ChevronDown size={14} className="shrink-0 opacity-70" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            ref={panelRef}
            role="listbox"
            aria-label={t("শিক্ষাবর্ষ", "Academic year")}
            tabIndex={-1}
            className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border-default bg-surface py-1 shadow-e3 focus:outline-none"
          >
            {years.map((y) => {
              const selected = y.id === yearId;
              return (
                <button
                  key={y.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setYearId(y.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-meta text-text-primary hover:bg-sunken"
                >
                  <Check size={14} className={cn("shrink-0", selected ? "text-primary" : "opacity-0")} />
                  <span className="flex-1 tnum">{y.year_label}</span>
                  {y.id === currentYearId ? (
                    <span className="rounded-full bg-success-bg px-2 py-0.5 text-micro font-semibold text-success-fg">
                      {t("চলতি", "Current")}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Persistent banner shown whenever an archived year is selected. */
export function ArchivedYearBanner() {
  const { t } = useT();
  const { year, isReadOnly, currentYearId, setYearId, years } = useAcademicYear();
  if (!isReadOnly || !year) return null;
  const currentLabel = years.find((y) => y.id === currentYearId)?.year_label ?? "";
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-warning-fg/30 bg-warning-bg px-4 py-2.5 text-meta font-medium text-warning-fg"
    >
      <span className="flex-1">
        {t(
          `শিক্ষাবর্ষ ${year.year_label} (আর্কাইভ) দেখছেন — শুধু পড়ার জন্য`,
          `Viewing academic year ${year.year_label} (archived) — read-only`,
        )}
      </span>
      {currentYearId ? (
        <button
          type="button"
          onClick={() => setYearId(currentYearId)}
          className="rounded-lg border border-warning-fg/40 bg-surface px-3 py-1.5 font-semibold text-text-primary hover:bg-sunken"
        >
          {t(`${currentLabel} এ ফিরুন`, `Switch to ${currentLabel} (current)`)}
        </button>
      ) : null}
    </div>
  );
}
