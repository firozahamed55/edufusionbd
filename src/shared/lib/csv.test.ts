import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv, suggestMapping, toCsv } from "./csv";

describe("parseCsv", () => {
  it("parses a plain sheet", () => {
    const { headers, rows } = parseCsv("name,roll\nRahim,1\nKarim,2");
    expect(headers).toEqual(["name", "roll"]);
    expect(rows).toEqual([["Rahim", "1"], ["Karim", "2"]]);
  });

  /**
   * The single most common thing in a real school file, and the one a naive
   * split gets wrong: an address with a comma shifts every later column by one
   * and imports a phone number into the religion field WITHOUT erroring.
   */
  it("keeps a quoted comma inside its field", () => {
    const { rows } = parseCsv('name,address,mobile\nRahim,"House 4, Road 2, Rampur",01712345678');
    expect(rows[0]).toEqual(["Rahim", "House 4, Road 2, Rampur", "01712345678"]);
  });

  it("treats a doubled quote as an escaped quote", () => {
    const { rows } = parseCsv('name\n"He said ""hello"""');
    expect(rows[0][0]).toBe('He said "hello"');
  });

  it("does not break a row on a newline inside quotes", () => {
    const { rows } = parseCsv('name,address\nRahim,"Line one\nLine two"\nKarim,Dhaka');
    expect(rows).toHaveLength(2);
    expect(rows[0][1]).toContain("Line one");
    expect(rows[0][1]).toContain("Line two");
    expect(rows[1][0]).toBe("Karim");
  });

  it("handles CRLF", () => {
    const { rows } = parseCsv("a,b\r\n1,2\r\n3,4");
    expect(rows).toEqual([["1", "2"], ["3", "4"]]);
  });

  /** Excel's "CSV UTF-8" export writes a BOM; left in place it becomes part of
   *  the first header name and that column never matches anything. */
  it("strips the BOM Excel writes", () => {
    const { headers } = parseCsv("﻿name,roll\nRahim,1");
    expect(headers[0]).toBe("name");
  });

  it("pads short rows so a column index is always safe", () => {
    const { rows } = parseCsv("a,b,c\n1,2");
    expect(rows[0]).toEqual(["1", "2", ""]);
  });

  it("skips blank lines", () => {
    const { rows } = parseCsv("a,b\n1,2\n\n\n3,4\n");
    expect(rows).toEqual([["1", "2"], ["3", "4"]]);
  });

  it("returns an empty table rather than throwing on an empty file", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
    expect(parseCsv("   \n  ")).toEqual({ headers: [], rows: [] });
  });

  it("carries Bengali text through unchanged", () => {
    const { headers, rows } = parseCsv("নাম,রোল\nরাহিম উদ্দিন,১");
    expect(headers).toEqual(["নাম", "রোল"]);
    expect(rows[0]).toEqual(["রাহিম উদ্দিন", "১"]);
  });
});

describe("detectDelimiter", () => {
  it.each([
    ["a,b,c\n1,2,3", ","],
    ["a;b;c\n1;2;3", ";"],
    ["a\tb\tc\n1\t2\t3", "\t"],
  ])("detects the delimiter in %j", (text, expected) => {
    expect(detectDelimiter(text)).toBe(expected);
  });

  it("falls back to comma for a single column", () => {
    expect(detectDelimiter("name\nRahim")).toBe(",");
  });

  it("parses a semicolon sheet correctly once detected", () => {
    // Excel on a comma-decimal locale writes these, and guessing wrong yields
    // exactly one column — so the operator is told their file has no columns.
    const { headers, rows } = parseCsv("name;roll\nRahim;1");
    expect(headers).toEqual(["name", "roll"]);
    expect(rows[0]).toEqual(["Rahim", "1"]);
  });
});

describe("suggestMapping", () => {
  const fields = [
    { key: "name_en", aliases: ["name", "student name", "full name"] },
    { key: "guardian_mobile", aliases: ["mobile", "guardian mobile", "phone"] },
    { key: "roll_no", aliases: ["roll"] },
  ];

  it("matches exact and aliased headers", () => {
    expect(suggestMapping(["Full Name", "Guardian Mobile", "Roll"], fields)).toEqual({
      name_en: 0, guardian_mobile: 1, roll_no: 2,
    });
  });

  it("ignores case, spaces, underscores and punctuation", () => {
    expect(suggestMapping(["name_en", "Guardian mobile no.", "ROLL"], fields)).toEqual({
      name_en: 0, guardian_mobile: 1, roll_no: 2,
    });
  });

  it("never assigns one column to two fields", () => {
    const mapping = suggestMapping(["Mobile"], fields);
    expect(Object.values(mapping)).toEqual([...new Set(Object.values(mapping))]);
  });

  it("omits fields it cannot match rather than guessing", () => {
    const mapping = suggestMapping(["something", "unrelated"], fields);
    expect(mapping.name_en).toBeUndefined();
  });
});

describe("toCsv", () => {
  it("round-trips through parseCsv", () => {
    const headers = ["name", "address"];
    const rows = [["Rahim", 'House 4, Road 2'], ["Karim", 'He said "hi"']];
    const parsed = parseCsv(toCsv(headers, rows));
    expect(parsed.headers).toEqual(headers);
    expect(parsed.rows).toEqual(rows);
  });

  it("quotes only what needs it", () => {
    expect(toCsv(["a", "b"], [["1", "2"]])).toBe("a,b\r\n1,2");
  });
});
