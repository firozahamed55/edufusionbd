import { describe, expect, it } from "vitest";
import { QUALITY_STEPS, ImageTooLargeError, replaceExtension, resizeImage, scaleFor } from "./imageResize";

describe("scaleFor", () => {
  it("never upscales", () => {
    expect(scaleFor(400, 300, 1024)).toBe(1);
    expect(scaleFor(1024, 200, 1024)).toBe(1);
  });

  it("scales by the LONGEST edge, so a portrait is not stretched", () => {
    expect(scaleFor(2048, 4096, 1024)).toBeCloseTo(0.25);
    expect(scaleFor(4096, 2048, 1024)).toBeCloseTo(0.25);
  });
});

describe("replaceExtension", () => {
  it.each([
    ["photo.png", "photo.jpg"],
    ["photo.JPEG", "photo.jpg"],
    ["no-extension", "no-extension.jpg"],
    ["a.b.c.heic", "a.b.c.jpg"],
    [".hidden", "image.jpg"],
  ])("%s -> %s", (input, expected) => {
    expect(replaceExtension(input, "jpg")).toBe(expected);
  });
});

describe("resizeImage", () => {
  /** jsdom has no canvas, so image paths are exercised in the browser. What is
   *  testable here is the passthrough contract, which is the part with a
   *  correctness consequence: a PDF that got rasterised would be unreadable. */
  it("returns non-images untouched", async () => {
    const pdf = new File([new Uint8Array(10)], "tc.pdf", { type: "application/pdf" });
    await expect(resizeImage(pdf)).resolves.toBe(pdf);
  });

  it("returns SVG untouched rather than rasterising it", async () => {
    const svg = new File(["<svg/>"], "sig.svg", { type: "image/svg+xml" });
    await expect(resizeImage(svg)).resolves.toBe(svg);
  });

  it("rejects an oversized non-image instead of uploading it", async () => {
    const big = new File([new Uint8Array(3 * 1024 * 1024)], "scan.pdf", { type: "application/pdf" });
    await expect(resizeImage(big)).rejects.toBeInstanceOf(ImageTooLargeError);
  });
});

describe("QUALITY_STEPS", () => {
  it("descends and stops before the range where a face photo mushes", () => {
    expect([...QUALITY_STEPS]).toEqual([...QUALITY_STEPS].sort((a, b) => b - a));
    expect(Math.min(...QUALITY_STEPS)).toBeGreaterThanOrEqual(0.5);
  });
});
