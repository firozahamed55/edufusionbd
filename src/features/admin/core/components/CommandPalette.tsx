"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Search, User } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { useDebouncedValue } from "@/shared/lib/useDebouncedValue";
import { ADMIN_ALL_MODULES } from "@/features/admin/components/adminNav";
import { useEntitySearch } from "../logic/hooks";
import { SEARCH_MIN_CHARS } from "../logic/api";

/**
 * ⌘K — jump to a screen, or to a person.
 *
 * The palette used to address only SCREENS. For a registrar the single most
 * frequent intent in the product is "find student 2026-0417", and it was
 * unserved (SRA §6): the only way to reach a student was to remember which
 * section they were in, open that roster, and scan. Typing a code or a name
 * here now goes straight to their profile.
 *
 * Screens resolve locally and instantly; people are a debounced query, so the
 * screen list never waits on the network. Entity results are appended rather
 * than interleaved — a two-letter prefix matches far more people than screens,
 * and burying "Fees & Finance" under six students would break the palette's
 * original job to fix its new one.
 */

type Entry = { href: string; bn: string; en: string };

function flatten(): Entry[] {
  const out: Entry[] = [];
  for (const mod of ADMIN_ALL_MODULES) {
    out.push({ href: mod.href, bn: mod.bn, en: mod.en });
    for (const tab of mod.tabs ?? []) out.push({ href: tab.href, bn: `${mod.bn} · ${tab.bn}`, en: `${mod.en} · ${tab.en}` });
  }
  return out;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, n, isBn } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const entries = useMemo(flatten, []);

  const debouncedQ = useDebouncedValue(q, 250);
  const people = useEntitySearch(open ? debouncedQ : "");

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return entries.slice(0, 8);
    return entries.filter((e) => e.bn.toLowerCase().includes(term) || e.en.toLowerCase().includes(term)).slice(0, 6);
  }, [q, entries]);

  const hits = people.data ?? [];
  const searching = q.trim().length >= SEARCH_MIN_CHARS && (people.isLoading || debouncedQ !== q.trim());

  useEffect(() => {
    if (open) { setQ(""); requestAnimationFrame(() => inputRef.current?.focus()); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const go = (href: string) => { router.push(href); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
      <button type="button" aria-label={t("বন্ধ করুন", "Close")} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div role="dialog" aria-modal="true" aria-label={t("কমান্ড প্যালেট", "Command palette")} className="relative z-10 w-full max-w-lg rounded-2xl bg-surface shadow-e3">
        <div className="flex items-center gap-2.5 border-b border-border-default px-4 py-3">
          <Search size={17} className="text-text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("স্ক্রিন, শিক্ষার্থী বা শিক্ষক খুঁজুন…", "Jump to a screen, student or teacher…")}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </div>

        {/* One live region for both lists — a screen-reader user typing here
            otherwise gets no signal that anything appeared underneath. */}
        <p aria-live="polite" className="sr-only">
          {searching
            ? t("খোঁজা হচ্ছে", "Searching")
            : t(`${n(results.length + hits.length)} টি ফলাফল`, `${results.length + hits.length} results`)}
        </p>

        <ul className="max-h-96 overflow-y-auto p-2">
          {results.length === 0 && hits.length === 0 && !searching ? (
            <li className="px-3 py-6 text-center text-meta text-text-muted">{t("কিছু পাওয়া যায়নি", "No matches")}</li>
          ) : null}

          {results.map((r, i) => (
            <li key={`${r.href}-${i}`}>
              <button
                onClick={() => go(r.href)}
                className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-text-primary hover:bg-sunken"
              >
                {isBn ? r.bn : r.en}
              </button>
            </li>
          ))}

          {hits.length > 0 ? (
            <li>
              <p className="px-3 pb-1 pt-3 text-micro font-semibold uppercase tracking-wide text-text-muted">
                {t("মানুষ", "People")}
              </p>
            </li>
          ) : null}

          {hits.map((h) => {
            const Icon = h.kind === "student" ? User : GraduationCap;
            return (
              <li key={`${h.kind}-${h.id}`}>
                <button
                  onClick={() => go(`/admin/${h.kind}/profile?id=${h.id}`)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-sunken"
                >
                  <Icon size={16} className="shrink-0 text-text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text-primary">{isBn ? h.name_bn : h.name_en}</span>
                    <span className="block truncate text-xs text-text-muted">
                      {[h.code ? n(h.code) : null, h.detail].filter(Boolean).join(" · ") || t(h.kind === "student" ? "শিক্ষার্থী" : "শিক্ষক", h.kind)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}

          {searching ? (
            <li className="px-3 py-3 text-center text-meta text-text-muted">{t("খোঁজা হচ্ছে…", "Searching…")}</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
