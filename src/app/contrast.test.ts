/**
 * WCAG 2.1 contrast regression test (audit A-1…A-4, roadmap 0.14).
 *
 * Reads the actual token values out of globals.css (not a hardcoded copy) so a
 * future edit that reintroduces a failing pair breaks this test instead of
 * shipping silently to all 56 admin screens at once.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const css = readFileSync(join(__dirname, "globals.css"), "utf-8");

function block(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

function readVar(scope: string, name: string): string {
  const re = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`);
  const m = scope.match(re);
  if (!m) throw new Error(`token not found: ${name}`);
  return m[1];
}

const light = block(css, ":root {");
const dark = block(css, '[data-theme="dark"] {');

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

/** WCAG 2.1 relative luminance. */
function luminance([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG 2.1 contrast ratio between two colors, order-independent. */
function contrast(hexA: string, hexB: string): number {
  const lA = luminance(hexToRgb(hexA));
  const lB = luminance(hexToRgb(hexB));
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

describe("token contrast (WCAG 2.1)", () => {
  it.each([
    ["light text-muted / surface", () => contrast(readVar(light, "--color-text-muted"), readVar(light, "--color-bg-surface")), 4.5],
    ["light text-muted / canvas", () => contrast(readVar(light, "--color-text-muted"), readVar(light, "--color-bg-canvas")), 4.5],
    ["light text-muted / sunken", () => contrast(readVar(light, "--color-text-muted"), readVar(light, "--color-bg-sunken")), 4.5],
    ["dark text-muted / surface", () => contrast(readVar(dark, "--color-text-muted"), readVar(dark, "--color-bg-surface")), 4.5],
    ["light danger-solid / white text", () => contrast(readVar(light, "--color-status-danger-solid"), "#ffffff"), 4.5],
    ["dark danger-solid / white text", () => contrast(readVar(dark, "--color-status-danger-solid"), "#ffffff"), 4.5],
    ["light focus-ring / surface", () => contrast(readVar(light, "--color-focus-ring"), readVar(light, "--color-bg-surface")), 3.0],
    ["dark focus-ring / surface", () => contrast(readVar(dark, "--color-focus-ring"), readVar(dark, "--color-bg-surface")), 3.0],
    ["light border-control / surface", () => contrast(readVar(light, "--color-border-control"), readVar(light, "--color-bg-surface")), 3.0],
    ["dark border-control / surface", () => contrast(readVar(dark, "--color-border-control"), readVar(dark, "--color-bg-surface")), 3.0],
  ])("%s clears its required ratio", (_label, get, min) => {
    expect(get()).toBeGreaterThanOrEqual(min);
  });
});
