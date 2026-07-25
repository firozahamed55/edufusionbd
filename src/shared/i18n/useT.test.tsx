/**
 * `useT` is the highest-leverage untested code in the product: every one of the
 * 55 screens renders its numbers through `n()`, and a school's marksheets, roll
 * numbers, fee amounts and dates are all numbers. A regression here is wrong
 * output on every page at once, in the language 90% of users read.
 *
 * The subtle part is that `n()` is deliberately idempotent — it normalises
 * Bengali digits to ASCII *first*, so it is safe to wrap a string that is already
 * Bengali. That property is what let the i18n rollout wrap existing hardcoded
 * values without rewriting the data, and nothing else in the codebase asserts it.
 */
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { useT } from "./useT";

const wrap = (locale: "bn" | "en") => {
  function LocaleWrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={{}}>
        {children}
      </NextIntlClientProvider>
    );
  }
  return LocaleWrapper;
};

const at = (locale: "bn" | "en") => renderHook(() => useT(), { wrapper: wrap(locale) }).result.current;

describe("t / tb", () => {
  it("picks the locale side", () => {
    expect(at("bn").t("শিক্ষার্থী", "Student")).toBe("শিক্ষার্থী");
    expect(at("en").t("শিক্ষার্থী", "Student")).toBe("Student");
    expect(at("bn").tb({ bn: "বকেয়া", en: "Due" })).toBe("বকেয়া");
  });

  it("reports the locale so screens can branch on it", () => {
    expect(at("bn").isBn).toBe(true);
    expect(at("en").isBn).toBe(false);
  });
});

describe("n", () => {
  it("renders ASCII input in the active locale", () => {
    expect(at("bn").n(45)).toBe("৪৫");
    expect(at("en").n(45)).toBe("45");
  });

  it("is idempotent on already-Bengali input", () => {
    // The property that made the i18n rollout possible without a data migration.
    expect(at("bn").n("২০৯২২২৬")).toBe("২০৯২২২৬");
  });

  it("converts Bengali input BACK to ASCII in the en locale", () => {
    expect(at("en").n("২০৯২২২৬")).toBe("2092226");
  });

  it("leaves non-digits alone, so formatted values survive", () => {
    expect(at("bn").n("2024-06-14")).toBe("২০২৪-০৬-১৪");
    expect(at("bn").n("৳ 1,250.50")).toBe("৳ ১,২৫০.৫০");
    expect(at("en").n("Class 9 — A")).toBe("Class 9 — A");
  });

  it("handles 0 and mixed digits without dropping characters", () => {
    expect(at("bn").n(0)).toBe("০");
    expect(at("bn").n("১2৩4")).toBe("১২৩৪");
    expect(at("en").n("১2৩4")).toBe("1234");
  });
});
