"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { FileSpreadsheet, CircleCheck, CircleAlert, Download, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import { Button, Field, Select, Modal, Badge, Stepper, useToast, Table, THead, TBody, TR, TH, TD } from "@/shared/ui";
import { parseCsv, suggestMapping, toCsv, type CsvTable } from "@/shared/lib/csv";
import type { ImportOutcome, ImportSpec, StagedRow } from "./types";

const UNMAPPED = -1;

/**
 * The shared import wizard (SRA A-0.5 point 1 — "highest ROI single feature in
 * the product").
 *
 * upload → map columns → validate → preview per-row errors → commit in batches
 * → downloadable error report. Wired to Students, Teachers and Marks.
 *
 * WHY VALIDATION HAPPENS TWICE. The client runs the module's own zod schema so
 * the operator sees "line 47: mobile must be 01XXXXXXXXX" *before* anything is
 * written; the RPC re-checks what only the database can know — does this class
 * exist, is this roll taken, is this student already here. Neither is
 * redundant, and skipping the first would mean a 500-row file whose problems
 * are discovered one round trip at a time.
 *
 * NOTHING IS WRITTEN BEFORE THE OPERATOR SEES THE PREVIEW. That is the whole
 * design: an import that half-lands and reports a number is how a school ends
 * up with 40 duplicate students and no way to tell which.
 */
export function ImportWizard<TRow extends Record<string, unknown>>({
  spec,
  open,
  onClose,
  onDone,
}: {
  spec: ImportSpec<TRow>;
  open: boolean;
  onClose: () => void;
  onDone?: (outcome: ImportOutcome) => void;
}) {
  const { t, n, isBn } = useT();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const batchSize = Math.min(spec.batchSize ?? 200, 500);

  function reset() {
    setStep(0); setFileName(""); setTable(null); setMapping({}); setOutcome(null); setProgress(null);
  }

  function close() { reset(); onClose(); }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.headers.length === 0) {
      toast({ title: t("ফাইলে কোনো কলাম পাওয়া যায়নি", "No columns found in that file"), variant: "error" });
      return;
    }
    setFileName(file.name);
    setTable(parsed);
    setMapping(
      suggestMapping(parsed.headers, spec.fields.map((f) => ({ key: f.key, aliases: f.aliases ?? [] }))),
    );
    setStep(1);
  }

  /** Map + transform + zod, per row. Pure — re-runs when the mapping changes,
   *  so fixing a column immediately re-validates the whole file. */
  const staged = useMemo<StagedRow[]>(() => {
    if (!table) return [];
    return table.rows.map((cells, i) => {
      const raw: Record<string, string> = {};
      for (const field of spec.fields) {
        const col = mapping[field.key];
        const cell = col != null && col >= 0 ? (cells[col] ?? "") : "";
        raw[field.key] = field.transform ? field.transform(cell) : cell;
      }
      const result = spec.schema.safeParse(raw);
      return {
        line: i + 2, // +1 for the header row, +1 because operators count from 1
        raw,
        parsed: result.success ? (result.data as Record<string, unknown>) : null,
        error: result.success ? null : firstIssue(result.error),
      };
    });
  }, [table, mapping, spec]);

  const valid = staged.filter((r) => r.parsed);
  const invalid = staged.filter((r) => !r.parsed);
  const missingRequired = spec.fields.filter((f) => f.required && (mapping[f.key] ?? UNMAPPED) < 0);

  async function commit() {
    setStep(3);
    const rows = valid.map((r) => r.parsed as TRow);
    setProgress({ done: 0, total: rows.length });

    const merged: ImportOutcome = { imported: 0, rejected: invalid.length, results: [] };
    // Client-side rejections carry the operator's own line numbers so the
    // report reads against the file they are looking at.
    for (const r of invalid) merged.results.push({ row: r.line, ok: false, error: r.error ?? "" });

    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize);
      try {
        const res = await spec.commit(slice);
        merged.imported += res.imported;
        merged.rejected += res.rejected;
        for (const item of res.results) {
          merged.results.push({ ...item, row: valid[i + item.row - 1]?.line ?? item.row });
        }
      } catch (e) {
        // A whole failed batch is reported per row rather than as one toast,
        // so the error report still accounts for every line in the file.
        merged.rejected += slice.length;
        const message = e instanceof Error ? e.message : String(e);
        for (let k = 0; k < slice.length; k++) {
          merged.results.push({ row: valid[i + k]?.line ?? i + k, ok: false, error: message });
        }
      }
      setProgress({ done: Math.min(i + batchSize, rows.length), total: rows.length });
    }

    merged.results.sort((a, b) => a.row - b.row);
    setOutcome(merged);
    setStep(4);
    onDone?.(merged);
  }

  function downloadTemplate() {
    download(
      `${spec.key}-template.csv`,
      toCsv(spec.fields.map((f) => f.key), [spec.fields.map((f) => f.example ?? "")]),
    );
  }

  function downloadErrors() {
    const failed = (outcome?.results ?? []).filter((r) => !r.ok);
    download(
      `${spec.key}-import-errors.csv`,
      toCsv(["line", "error"], failed.map((r) => [r.row, r.error ?? ""])),
    );
  }

  const steps = [
    t("ফাইল", "File"),
    t("কলাম মিলান", "Map columns"),
    t("যাচাই", "Review"),
    t("আমদানি", "Import"),
    t("ফলাফল", "Result"),
  ];

  return (
    <Modal
      open={open}
      onClose={close}
      title={t(spec.title.bn, spec.title.en)}
      description={t(spec.description.bn, spec.description.en)}
      className="max-w-3xl"
      footer={
        step === 0 ? (
          <Button variant="secondary" onClick={close}>{t("বাতিল", "Cancel")}</Button>
        ) : step === 1 ? (
          <>
            <Button variant="secondary" onClick={() => setStep(0)}><ArrowLeft size={15} /> {t("পিছনে", "Back")}</Button>
            <Button variant="primary" onClick={() => setStep(2)} disabled={missingRequired.length > 0}>
              {t("যাচাই করুন", "Review")} <ArrowRight size={15} />
            </Button>
          </>
        ) : step === 2 ? (
          <>
            <Button variant="secondary" onClick={() => setStep(1)}><ArrowLeft size={15} /> {t("কলাম ঠিক করুন", "Fix columns")}</Button>
            <Button variant="primary" onClick={() => void commit()} disabled={valid.length === 0}>
              {t(`${n(valid.length)}টি সারি আমদানি করুন`, `Import ${valid.length} rows`)}
            </Button>
          </>
        ) : step === 4 ? (
          <>
            <Button variant="secondary" onClick={reset}>{t("আরেকটি ফাইল", "Another file")}</Button>
            <Button variant="primary" onClick={close}>{t("সম্পন্ন", "Done")}</Button>
          </>
        ) : null
      }
    >
      <div className="flex flex-col gap-5">
        <Stepper steps={steps} current={step} />

        {/* ---------------------------------------------------------- upload */}
        {step === 0 ? (
          <div className="flex flex-col gap-3">
            <label className="flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border border-dashed border-border-strong bg-sunken px-5 py-8 text-center">
              <span className="grid size-14 place-items-center rounded-xl bg-primary-subtle text-primary">
                <FileSpreadsheet size={26} />
              </span>
              <span className="text-sm font-medium text-text-secondary">
                {t("CSV ফাইল নির্বাচন করুন", "Choose a CSV file")}
              </span>
              <span className="text-xs text-text-muted">
                {t("Excel থেকে ‘CSV UTF-8’ হিসেবে সেভ করুন", "From Excel, save as ‘CSV UTF-8’")}
              </span>
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void onFile(e)} />
            </label>
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex items-center justify-center gap-1.5 text-meta font-medium text-primary hover:underline"
            >
              <Download size={14} /> {t("খালি টেমপ্লেট ডাউনলোড করুন", "Download a blank template")}
            </button>
          </div>
        ) : null}

        {/* ------------------------------------------------------ map columns */}
        {step === 1 && table ? (
          <div className="flex flex-col gap-3">
            <p className="text-meta text-text-secondary">
              <FileSpreadsheet size={14} className="mr-1 inline" />
              {fileName} · {t(`${n(table.rows.length)}টি সারি`, `${table.rows.length} rows`)}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {spec.fields.map((f) => (
                <Field
                  key={f.key}
                  label={t(f.bn, f.en)}
                  required={f.required}
                  hint={f.example ? `${t("যেমন", "e.g.")} ${f.example}` : undefined}
                >
                  <Select
                    value={String(mapping[f.key] ?? UNMAPPED)}
                    options={[
                      { value: String(UNMAPPED), label: t("— কোনোটি নয় —", "— none —") },
                      ...table.headers.map((h, i) => ({ value: String(i), label: h || `#${i + 1}` })),
                    ]}
                    onChange={(e) => setMapping((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
                  />
                </Field>
              ))}
            </div>
            {missingRequired.length > 0 ? (
              <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-meta text-danger-fg">
                {t("এই ফিল্ডগুলো আবশ্যক", "These fields are required")}:{" "}
                {missingRequired.map((f) => t(f.bn, f.en)).join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ----------------------------------------------------------- review */}
        {step === 2 ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone="success" dot>{t(`${n(valid.length)}টি প্রস্তুত`, `${valid.length} ready`)}</Badge>
              {invalid.length > 0 ? (
                <Badge tone="danger" dot>{t(`${n(invalid.length)}টিতে সমস্যা`, `${invalid.length} with problems`)}</Badge>
              ) : null}
            </div>

            {invalid.length > 0 ? (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border-default">
                <Table>
                  <THead>
                    <TR>
                      <TH className="w-20">{t("লাইন", "Line")}</TH>
                      <TH>{t("সমস্যা", "Problem")}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {invalid.slice(0, 50).map((r) => (
                      <TR key={r.line}>
                        <TD className="tnum">{n(r.line)}</TD>
                        <TD className="text-danger-fg">{r.error}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
                {invalid.length > 50 ? (
                  <p className="px-4 py-2 text-micro text-text-muted">
                    {t(
                      `আরও ${n(invalid.length - 50)}টি সমস্যা — সম্পূর্ণ তালিকা আমদানির পর ডাউনলোড করা যাবে।`,
                      `${invalid.length - 50} more — the full list is downloadable after the import.`,
                    )}
                  </p>
                ) : null}
              </div>
            ) : null}

            <p className="text-meta text-text-muted">
              {invalid.length > 0
                ? t(
                    "সমস্যাযুক্ত সারিগুলো বাদ যাবে; বাকিগুলো আমদানি হবে। এখনও কিছুই সংরক্ষণ করা হয়নি।",
                    "Rows with problems are skipped; the rest are imported. Nothing has been written yet.",
                  )
                : t("এখনও কিছুই সংরক্ষণ করা হয়নি।", "Nothing has been written yet.")}
            </p>

            {valid.length > 0 ? <PreviewTable spec={spec} rows={valid} isBn={isBn} /> : null}
          </div>
        ) : null}

        {/* --------------------------------------------------------- progress */}
        {step === 3 ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-meta text-text-secondary" aria-live="polite">
              {t(
                `${n(progress?.done ?? 0)} / ${n(progress?.total ?? 0)} আমদানি হচ্ছে…`,
                `Importing ${progress?.done ?? 0} of ${progress?.total ?? 0}…`,
              )}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-strong">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* ----------------------------------------------------------- result */}
        {step === 4 && outcome ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-sunken px-4 py-3">
              <CircleCheck size={20} className="text-success-fg" />
              <span className="text-sm font-semibold text-text-primary">
                {t(`${n(outcome.imported)}টি আমদানি হয়েছে`, `${outcome.imported} imported`)}
              </span>
              {outcome.rejected > 0 ? (
                <>
                  <CircleAlert size={20} className="text-danger-fg" />
                  <span className="text-sm font-semibold text-text-primary">
                    {t(`${n(outcome.rejected)}টি বাদ পড়েছে`, `${outcome.rejected} rejected`)}
                  </span>
                </>
              ) : null}
            </div>

            {outcome.rejected > 0 ? (
              <>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border-default">
                  <Table>
                    <THead>
                      <TR>
                        <TH className="w-20">{t("লাইন", "Line")}</TH>
                        <TH>{t("কারণ", "Reason")}</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {outcome.results.filter((r) => !r.ok).slice(0, 100).map((r) => (
                        <TR key={`${r.row}-${r.error}`}>
                          <TD className="tnum">{n(r.row)}</TD>
                          <TD className="text-danger-fg">{r.error}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
                <Button variant="secondary" className="self-start" onClick={downloadErrors}>
                  <Download size={15} /> {t("সমস্যার তালিকা ডাউনলোড", "Download the error report")}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/** First five rows, mapped — so the operator sees the columns landed where
 *  they think, not just that the count is right. */
function PreviewTable<TRow extends Record<string, unknown>>({
  spec, rows, isBn,
}: {
  spec: ImportSpec<TRow>;
  rows: StagedRow[];
  isBn: boolean;
}) {
  const shown = spec.fields.slice(0, 5);
  return (
    <div className="overflow-x-auto rounded-lg border border-border-default">
      <Table>
        <THead>
          <TR>
            {shown.map((f) => <TH key={f.key}>{isBn ? f.bn : f.en}</TH>)}
          </TR>
        </THead>
        <TBody>
          {rows.slice(0, 5).map((r) => (
            <TR key={r.line}>
              {shown.map((f) => (
                <TD key={f.key} className={cn("max-w-40 truncate", !r.raw[f.key] && "text-text-muted")}>
                  {r.raw[f.key] || "—"}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

/** The first zod issue, named by field — "guardian_mobile: must be 01XXXXXXXXX"
 *  rather than a JSON blob the operator cannot act on. */
function firstIssue(error: { issues: { path: (string | number)[]; message: string }[] }): string {
  const issue = error.issues[0];
  if (!issue) return "invalid";
  const field = issue.path.join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}

function download(filename: string, content: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
