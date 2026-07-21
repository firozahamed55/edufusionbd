"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { ADMIN_NAV_SECTIONS, ADMIN_NAV_FOOTER, type AdminNavItem, type AdminSubItem } from "@/features/admin/components/adminNav";

type Entry = { href: string; bn: string; en: string };

function flatten(): Entry[] {
  const out: Entry[] = [];
  const addSub = (s: AdminSubItem) => out.push({ href: s.href, bn: s.bn, en: s.en });
  const addItem = (i: AdminNavItem) => {
    out.push({ href: i.href, bn: i.bn, en: i.en });
    i.sub?.forEach((group) => group.items.forEach(addSub));
  };
  ADMIN_NAV_SECTIONS.forEach((s) => s.items.forEach(addItem));
  ADMIN_NAV_FOOTER.forEach(addItem);
  return out;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, isBn } = useT();
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const entries = useMemo(flatten, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return entries.slice(0, 8);
    return entries.filter((e) => e.bn.toLowerCase().includes(term) || e.en.toLowerCase().includes(term)).slice(0, 8);
  }, [q, entries]);

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
      <div role="dialog" aria-modal="true" aria-label={t("কমান্ড প্যালেট", "Command palette")} className="relative z-10 w-full max-w-lg rounded-2xl border border-border-default bg-surface shadow-e3">
        <div className="flex items-center gap-2.5 border-b border-border-default px-4 py-3">
          <Search size={17} className="text-text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("স্ক্রিন খুঁজুন…", "Jump to a screen…")}
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-meta text-text-muted">{t("কিছু পাওয়া যায়নি", "No matches")}</li>
          ) : (
            results.map((r, i) => (
              <li key={`${r.href}-${i}`}>
                <button
                  onClick={() => go(r.href)}
                  className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-text-primary hover:bg-sunken"
                >
                  {isBn ? r.bn : r.en}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
