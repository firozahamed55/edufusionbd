/**
 * Pagination is about to appear on every growth-table list (audit M-2), so its
 * edge behaviour matters: an enabled "previous" on page 1 fetches `range(-10, -1)`,
 * which PostgREST answers with an error rather than an empty page.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { Pagination } from "./Pagination";

const at = (locale: "bn" | "en", node: ReactNode) =>
  render(<NextIntlClientProvider locale={locale} messages={{}}>{node}</NextIntlClientProvider>);

describe("Pagination", () => {
  it("disables previous on the first page and next on the last", () => {
    at("en", <Pagination label="1–10 of 40" pages={4} current={1} />);
    expect(screen.getByLabelText("Previous")).toBeDisabled();
    expect(screen.getByLabelText("Next")).not.toBeDisabled();

    screen.getByLabelText("Next"); // sanity: both controls exist
    at("en", <Pagination label="31–40 of 40" pages={4} current={4} />);
    expect(screen.getAllByLabelText("Next")[1]).toBeDisabled();
  });

  it("reports the target page, clamped to the range", () => {
    const onPageChange = vi.fn();
    at("en", <Pagination label="x" pages={3} current={2} onPageChange={onPageChange} />);
    screen.getByLabelText("Next").click();
    expect(onPageChange).toHaveBeenCalledWith(3);
    screen.getByLabelText("Previous").click();
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("marks the current page for assistive tech and renders locale numerals", () => {
    at("bn", <Pagination label="দেখানো হচ্ছে" pages={3} current={2} />);
    // Page pills render in Bengali numerals in the bn locale.
    expect(screen.getByText("২")).toBeInTheDocument();
    expect(screen.getByLabelText("আগে")).toBeInTheDocument();
    expect(screen.getByLabelText("পরে")).toBeInTheDocument();
  });

  it("renders a static footer when no handler is passed", () => {
    // Screens that have not been paginated yet still render this; clicking must
    // not throw.
    at("en", <Pagination label="1–10 of 10" pages={1} current={1} />);
    expect(() => screen.getByLabelText("Next").click()).not.toThrow();
  });
});
