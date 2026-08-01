import { describe, it, expect } from "vitest";
import { safeFileName, ASSET_MIME_TYPES, ASSET_MAX_BYTES } from "./institutionAssets";

/**
 * `file.name` used to go straight into the storage object path. These are the
 * inputs a real office assistant produces — a phone gallery name, a Bengali
 * filename, a path traversal someone typed once — not synthetic edge cases.
 */
describe("safeFileName", () => {
  it("keeps a plain name and its extension", () => {
    expect(safeFileName("logo.png")).toBe("logo.png");
  });

  it("slugifies spaces and punctuation", () => {
    expect(safeFileName("School Logo (final) v2.PNG")).toBe("school-logo-final-v2.png");
  });

  it("survives a name with no Latin characters at all", () => {
    // Bengali stem normalises away entirely; the fallback keeps the extension
    // so the object is still recognisable as an image.
    expect(safeFileName("স্বাক্ষর.png")).toBe("file.png");
  });

  it("cannot escape its directory", () => {
    const out = safeFileName("../../etc/passwd");
    expect(out).not.toContain("..");
    expect(out).not.toContain("/");
  });

  it("drops query and fragment characters that would break a signed URL", () => {
    const out = safeFileName("logo?v=1#top.png");
    expect(out).not.toMatch(/[?#]/);
  });

  it("bounds the length", () => {
    expect(safeFileName(`${"a".repeat(300)}.png`).length).toBeLessThanOrEqual(53);
  });

  it("handles a name with no extension", () => {
    expect(safeFileName("signature")).toBe("signature");
  });
});

describe("bucket contract", () => {
  it("mirrors what the bucket accepts", () => {
    // If these drift from `20260801172000_constrain_institution_assets_bucket.sql`
    // the operator gets a storage 413/415 instead of a sentence they can read.
    expect([...ASSET_MIME_TYPES]).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
    ]);
    expect(ASSET_MAX_BYTES).toBe(2 * 1024 * 1024);
  });
});
