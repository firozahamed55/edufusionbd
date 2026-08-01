import { describe, expect, it } from "vitest";
import { PASSWORD_RULES, isAcceptable, passedRules, scorePassword } from "./passwordPolicy";

describe("passedRules", () => {
  it("reports each rule independently", () => {
    expect([...passedRules("")]).toEqual([]);
    expect([...passedRules("abcdefgh")].sort()).toEqual(["length"]);
    expect([...passedRules("Abcdefgh")].sort()).toEqual(["case", "length"]);
    expect([...passedRules("Abcdefg1")].sort()).toEqual(["case", "digit", "length"]);
    expect([...passedRules("Abcdefg1!")].sort()).toEqual(["case", "digit", "length", "symbol"]);
  });

  it("has a rule set the checklist can render — each with both languages", () => {
    for (const rule of PASSWORD_RULES) {
      expect(rule.bn.length).toBeGreaterThan(0);
      expect(rule.en.length).toBeGreaterThan(0);
    }
  });
});

describe("isAcceptable", () => {
  it("requires length no matter how varied the rest is", () => {
    // Every other rule passes; still too short.
    expect(isAcceptable("Ab1!")).toBe(false);
  });

  it("accepts three of four with length", () => {
    expect(isAcceptable("Rahim2026")).toBe(true);
  });

  it("does not demand a symbol", () => {
    // A hard symbol rule is the most reliable way to push a school office onto
    // a sticky note; this is a deliberate policy choice, so it is pinned.
    expect(isAcceptable("SchoolYear2026")).toBe(true);
  });

  it("rejects length-only", () => {
    expect(isAcceptable("aaaaaaaaaaaa")).toBe(false);
  });
});

describe("scorePassword", () => {
  it("is 0 for empty", () => {
    expect(scorePassword("")).toBe(0);
  });

  it("rises with variety", () => {
    // Deliberately not `abcdefgh` -> `Abcdefg1`: BOTH contain the `abcd`
    // keyboard run and are correctly capped at 1, so that pair tests nothing.
    expect(scorePassword("mynewpass")).toBeLessThan(scorePassword("MyNewPass"));
    expect(scorePassword("MyNewPass")).toBeLessThan(scorePassword("MyNewPass7"));
    expect(scorePassword("MyNewPass7")).toBeLessThanOrEqual(scorePassword("MyNewPass7#"));
  });

  it("rewards real length", () => {
    expect(scorePassword("Tk9#mQ2vLz8@rE4w")).toBe(4);
  });

  /**
   * The case the rule set alone gets wrong: these all SATISFY three or four
   * rules and are still trivially guessable. Without the penalty the meter
   * would show "Strong" for Password1! — which is worse than no meter, because
   * it endorses the choice.
   */
  it.each(["Password1!", "Aaa11111!", "Abcd1234!", "Qwerty123!", "EduFusion1!", "Admin1234!"])(
    "caps the obvious pattern %s at weak",
    (pw) => {
      expect(scorePassword(pw)).toBeLessThanOrEqual(1);
    },
  );

  it("never leaves the 0–4 range", () => {
    for (const pw of ["", "a", "aA1!", "x".repeat(200), "Tk9#mQ2vLz8@rE4wZZZZ"]) {
      const s = scorePassword(pw);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(4);
    }
  });
});
