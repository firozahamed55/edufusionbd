import type { z } from "zod";

/**
 * The contract a module implements to gain an importer (SRA A-0.5 point 1).
 *
 * One `<ImportWizard>` serves Students, Teachers and Marks; the differences
 * live here, in data, rather than in three copies of a wizard.
 */

export type ImportField = {
  key: string;
  bn: string;
  en: string;
  /** Header spellings seen in real exported sheets. Drives auto-mapping. */
  aliases?: readonly string[];
  required?: boolean;
  /** Shown in the blank template and the column-mapping help. */
  example?: string;
  /**
   * Turn a raw cell into what the RPC expects. Runs before zod, so a Bengali
   * numeral, a `dd/mm/yyyy` date or a display label can all be normalised at
   * the boundary rather than in the schema.
   */
  transform?: (raw: string) => string;
};

export type ImportRowResult = { row: number; ok: boolean; error?: string; id?: string };

export type ImportOutcome = {
  imported: number;
  rejected: number;
  results: ImportRowResult[];
};

export type ImportSpec<TRow extends Record<string, unknown>> = {
  key: string;
  title: { bn: string; en: string };
  description: { bn: string; en: string };
  fields: readonly ImportField[];
  /** The SAME schema the module's manual form validates against. */
  schema: z.ZodType<TRow, z.ZodTypeDef, unknown>;
  /** Rows per RPC call. The database caps this at 500. */
  batchSize?: number;
  /** Commit one batch. Returns a per-row outcome. */
  commit: (rows: TRow[]) => Promise<ImportOutcome>;
};

/** A row as the wizard holds it between mapping and commit. */
export type StagedRow = {
  /** 1-based line number in the operator's file, for every message shown. */
  line: number;
  raw: Record<string, string>;
  parsed: Record<string, unknown> | null;
  error: string | null;
};
