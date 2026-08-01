import { createClient } from "@/shared/services/supabase/client";

/**
 * What is being exported, and under which filters (R-7).
 *
 * REQUIRED, not optional. `export_log` sat in the schema with RLS and zero rows
 * for two phases because writing to it was nobody's job in particular; an
 * optional audit argument would reproduce that exactly, one forgetful call site
 * at a time. Making it part of the signature means the typechecker, not a
 * reviewer's memory, is what keeps every export accountable.
 */
export type ExportAudit = {
  /**
   * Stable identifier for the report. Stable matters: an auditor filters on
   * this, so it must not track a UI label that changes with the locale or with
   * a copy edit.
   */
  kind: string;
  /** The filters the export ran under — "how much of the roll did they take". */
  params?: Record<string, unknown>;
};

/**
 * Client-side CSV download — no server round-trip, no new dependency.
 * The UTF-8 BOM prefix matters here specifically: this app is bilingual
 * Bengali/English, and Excel silently mangles Bengali text in a BOM-less CSV.
 *
 * Every call also writes an `export_log` row. Nineteen screens reach this
 * function and several of them emit full student rosters carrying guardian
 * mobile numbers; for a system holding 268 minors' records, "who took a copy of
 * the roll, and when" is the question most likely to be asked by a regulator or
 * an incident review. The actor is set by the database from `auth.uid()` inside
 * `fn_log_export`, never by the caller — a log whose actor column is written by
 * the party being logged is not evidence of anything.
 */
export function exportCsv(
  filename: string,
  rows: Record<string, unknown>[],
  audit: ExportAudit,
): void {
  // Nothing was disclosed, so there is nothing to record.
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  /**
   * Fire-and-forget, and deliberately AFTER the download.
   *
   * The log is an accountability record, not a gate. If the RPC is slow the
   * user still gets their file; if it fails the export has already happened, so
   * blocking on it would only mean losing the work as well as the record. The
   * failure is reported to the console rather than swallowed, because a log
   * that has quietly stopped writing is worse than one that never started —
   * this table's whole problem the first time round was being empty without
   * anyone noticing.
   */
  void createClient()
    .rpc("fn_log_export", {
      payload: { kind: audit.kind, params: audit.params ?? {}, rows: rows.length, filename },
    })
    .then(({ error }) => {
      if (error) console.error("export_log write failed", { kind: audit.kind, error });
    });
}
