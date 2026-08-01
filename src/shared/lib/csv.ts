/**
 * CSV parsing for the Import Wizard (SRA A-0.5 point 1).
 *
 * WHY NOT PapaParse. The input is a sheet a school office exported from Excel:
 * comma or semicolon separated, quoted fields, CRLF, a UTF-8 BOM, and Bengali
 * text. That is ~90 lines. PapaParse is 45 kB for worker threads, streaming and
 * a dozen dialects this never sees.
 *
 * What it DOES have to get right is quoting — a guardian address containing a
 * comma is the single most common thing in these files, and a naive `split(",")`
 * shifts every subsequent column by one and imports a phone number into the
 * religion field without erroring.
 */

export type CsvTable = { headers: string[]; rows: string[][] };

/** Strip the BOM Excel writes on "CSV UTF-8" export; it otherwise becomes part
 *  of the first header name and no column ever matches it. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Detect the delimiter from the header line.
 *
 * Excel on a machine with a comma decimal separator — which is the default in
 * several locales — writes semicolons. Guessing wrong yields exactly one
 * column, and the operator is told "your file has no columns" about a file
 * that plainly does.
 */
export function detectDelimiter(text: string): string {
  const firstLine = stripBom(text).split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t", "|"].map((d) => ({
    d,
    n: splitLine(firstLine, d).length,
  }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 1 ? counts[0].d : ",";
}

/** One line, honouring RFC 4180 quoting (`""` is an escaped quote). */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

/**
 * Parse a whole file.
 *
 * Newlines inside quotes are part of the field, not a row break — a multi-line
 * address in a spreadsheet cell is normal, and splitting on it turns one
 * student into two half-students.
 */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): CsvTable {
  const src = stripBom(text);
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"') {
      inQuotes = !inQuotes || src[i + 1] === '"';
      if (inQuotes && src[i + 1] === '"') { current += '""'; i++; continue; }
      current += ch;
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      lines.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.length > 0) lines.push(current);

  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = splitLine(nonEmpty[0], delimiter).map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((l) => {
    const cells = splitLine(l, delimiter).map((c) => c.trim());
    // Pad short rows so a column index is always safe. A trailing empty column
    // is routinely omitted by hand-edited files.
    while (cells.length < headers.length) cells.push("");
    return cells;
  });

  return { headers, rows };
}

/**
 * Suggest a column for each target field by fuzzy header match.
 *
 * The operator can override every guess; this exists so the common case —
 * a sheet exported from this product, or one using the obvious English names —
 * needs no mapping at all. Matching is accent- and case-insensitive and
 * ignores spaces, underscores and punctuation, because "Guardian Mobile",
 * "guardian_mobile" and "Guardian mobile no." are the same column.
 */
export function suggestMapping(
  headers: readonly string[],
  fields: readonly { key: string; aliases: readonly string[] }[],
): Record<string, number> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ঀ-৿]/g, "");
  const normHeaders = headers.map(norm);
  const out: Record<string, number> = {};
  const taken = new Set<number>();

  for (const field of fields) {
    const candidates = [field.key, ...field.aliases].map(norm);
    let index = normHeaders.findIndex((h, i) => !taken.has(i) && candidates.includes(h));
    if (index < 0) {
      index = normHeaders.findIndex(
        (h, i) => !taken.has(i) && h.length > 2 && candidates.some((cand) => cand.length > 2 && (h.includes(cand) || cand.includes(h))),
      );
    }
    if (index >= 0) { out[field.key] = index; taken.add(index); }
  }
  return out;
}

/** Serialise a table back to CSV — used for the downloadable error report and
 *  the blank template. */
export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const cell = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\r\n");
}
