import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDataScreen, applyClientList } from "./useDataScreen";

// One shared URL, driven by the mocked router — so the assertions below are
// about what lands in the address bar, which is the whole point of the hook.
let url = "/admin/x";
const replace = vi.fn((next: string) => { url = next; });

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => url.split("?")[0],
  useSearchParams: () => new URLSearchParams(url.split("?")[1] ?? ""),
}));

const params = () => new URLSearchParams(url.split("?")[1] ?? "");

beforeEach(() => { url = "/admin/x"; replace.mockClear(); });

describe("useDataScreen", () => {
  it("puts search in the URL and returns to page 1", () => {
    const { result, rerender } = renderHook(() => useDataScreen());
    act(() => result.current.setPage(4));
    rerender();
    expect(params().get("page")).toBe("4");

    act(() => result.current.setQ("rahim"));
    rerender();
    expect(params().get("q")).toBe("rahim");
    // Filtering while on page 4 would otherwise show an empty table that reads
    // as "no results".
    expect(params().get("page")).toBeNull();
  });

  it("keeps a pristine list out of the URL entirely", () => {
    const { result, rerender } = renderHook(() => useDataScreen());
    act(() => result.current.setQ("a"));
    rerender();
    act(() => result.current.setQ(""));
    rerender();
    expect(url).toBe("/admin/x");
  });

  it("round-trips sort through the URL", () => {
    const { result, rerender } = renderHook(() => useDataScreen());
    act(() => result.current.setSort({ key: "name", dir: "desc" }));
    rerender();
    expect(result.current.sort).toEqual({ key: "name", dir: "desc" });
    act(() => result.current.setSort(null));
    rerender();
    expect(result.current.sort).toBeNull();
  });

  it("exposes screen-defined filters", () => {
    const { result, rerender } = renderHook(() => useDataScreen({ filters: { status: "" } }));
    act(() => result.current.setFilter("status", "active"));
    rerender();
    expect(result.current.filters.status).toBe("active");
    expect(params().get("status")).toBe("active");
  });

  it("reports and clears a narrowed view", () => {
    const { result, rerender } = renderHook(() => useDataScreen({ filters: { status: "" } }));
    expect(result.current.isFiltered).toBe(false);
    act(() => result.current.setFilter("status", "active"));
    rerender();
    expect(result.current.isFiltered).toBe(true);
    act(() => result.current.reset());
    rerender();
    expect(result.current.isFiltered).toBe(false);
    expect(url).toBe("/admin/x");
  });

  it("computes paging labels", () => {
    const { result, rerender } = renderHook(() => useDataScreen({ perPage: 20 }));
    expect(result.current.pages(45)).toBe(3);
    expect(result.current.pages(0)).toBe(1);
    act(() => result.current.setPage(3));
    rerender();
    expect(result.current.from).toBe(41);
    expect(result.current.to(45)).toBe(45);
  });

  describe("selection", () => {
    it('treats "select all" as this page only', () => {
      const { result, rerender } = renderHook(() => useDataScreen());
      act(() => { result.current.useSelection(["a", "b"]).toggleAll(); });
      rerender();
      expect(result.current.useSelection(["a", "b"]).count).toBe(2);

      // Page 2. Selection survives, but "all on page" is about THIS page — a
      // `selected.size === rows.length` check would report true here and be wrong.
      const page2 = result.current.useSelection(["c", "d"]);
      expect(page2.count).toBe(2);
      expect(page2.allOnPage).toBe(false);
      expect(page2.someOnPage).toBe(false);
    });

    it("deselects only the current page", () => {
      const { result, rerender } = renderHook(() => useDataScreen());
      act(() => { result.current.useSelection(["a", "b"]).toggleAll(); });
      rerender();
      act(() => { result.current.useSelection(["c"]).toggleAll(); });
      rerender();
      expect(result.current.useSelection([]).count).toBe(3);

      act(() => { result.current.useSelection(["a", "b"]).toggleAll(); });
      rerender();
      expect(result.current.useSelection([]).asArray()).toEqual(["c"]);
    });

    it("reports a partial page as indeterminate", () => {
      const { result, rerender } = renderHook(() => useDataScreen());
      act(() => { result.current.useSelection(["a", "b"]).toggle("a"); });
      rerender();
      const sel = result.current.useSelection(["a", "b"]);
      expect(sel.allOnPage).toBe(false);
      expect(sel.someOnPage).toBe(true);
    });

    it("clears everything across pages", () => {
      const { result, rerender } = renderHook(() => useDataScreen());
      act(() => { result.current.useSelection(["a", "b"]).toggleAll(); });
      rerender();
      act(() => { result.current.useSelection([]).clear(); });
      rerender();
      expect(result.current.useSelection([]).count).toBe(0);
    });
  });
});

describe("applyClientList", () => {
  type Row = { name: string; roll: number | null };
  const rows: Row[] = [
    { name: "Rahim", roll: 3 },
    { name: "Karim", roll: 1 },
    { name: "Salma", roll: null },
    { name: "Rahima", roll: 12 },
  ];
  const acc = {
    search: (r: Row) => [r.name, r.roll],
    sort: { name: (r: Row) => r.name, roll: (r: Row) => r.roll },
  };
  const view = { debouncedQ: "", sort: null, page: 1, perPage: 20 } as const;

  it("passes everything through untouched by default", () => {
    expect(applyClientList(rows, view, acc)).toEqual({ rows, total: 4 });
  });

  it("searches case-insensitively across the given fields", () => {
    const out = applyClientList(rows, { ...view, debouncedQ: "rahi" }, acc);
    expect(out.rows.map((r) => r.name)).toEqual(["Rahim", "Rahima"]);
    // `total` is the FILTERED count — it drives the pager and the announcement.
    expect(out.total).toBe(2);
  });

  it("sorts numerically, not lexically", () => {
    const out = applyClientList(rows, { ...view, sort: { key: "roll", dir: "asc" } }, acc);
    expect(out.rows.map((r) => r.roll)).toEqual([1, 3, 12, null]);
  });

  it("sinks blanks in both directions", () => {
    const asc = applyClientList(rows, { ...view, sort: { key: "roll", dir: "asc" } }, acc);
    const desc = applyClientList(rows, { ...view, sort: { key: "roll", dir: "desc" } }, acc);
    expect(asc.rows.at(-1)?.roll).toBeNull();
    expect(desc.rows.at(-1)?.roll).toBeNull();
  });

  it("pages, reporting the pre-page total", () => {
    const out = applyClientList(rows, { ...view, perPage: 2, page: 2 }, acc);
    expect(out.rows).toHaveLength(2);
    expect(out.total).toBe(4);
  });

  it("ignores a sort key the screen did not declare", () => {
    const out = applyClientList(rows, { ...view, sort: { key: "nope", dir: "asc" } }, acc);
    expect(out.rows.map((r) => r.name)).toEqual(["Rahim", "Karim", "Salma", "Rahima"]);
  });

  it("does not mutate the caller's array", () => {
    const original = [...rows];
    applyClientList(rows, { ...view, sort: { key: "name", dir: "asc" } }, acc);
    expect(rows).toEqual(original);
  });
});
