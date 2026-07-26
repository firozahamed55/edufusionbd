/**
 * `useQueryState` is what makes list views addressable (RC-4). Its two
 * non-obvious behaviours are the ones worth pinning: values equal to their
 * default are absent from the URL (so a pristine list has a clean address),
 * and numeric defaults come back as numbers rather than strings.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useQueryState } from "./useQueryState";

const replace = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/admin/teacher/list",
  useSearchParams: () => new URLSearchParams(search),
}));

describe("useQueryState", () => {
  beforeEach(() => {
    replace.mockClear();
    search = "";
  });

  it("falls back to defaults when the URL is empty", () => {
    const { result } = renderHook(() => useQueryState({ q: "", page: 1 }));
    expect(result.current[0]).toEqual({ q: "", page: 1 });
  });

  it("coerces to the type of the default", () => {
    search = "q=rahim&page=3";
    const { result } = renderHook(() => useQueryState({ q: "", page: 1 }));
    expect(result.current[0]).toEqual({ q: "rahim", page: 3 });
    expect(typeof result.current[0].page).toBe("number");
  });

  it("writes non-default values and omits default ones", () => {
    const { result } = renderHook(() => useQueryState({ q: "", page: 1 }));
    act(() => result.current[1]({ q: "rahim", page: 1 }));
    // page=1 is the default → must not appear; q must.
    expect(replace).toHaveBeenCalledWith("/admin/teacher/list?q=rahim", { scroll: false });
  });

  it("drops a param when it returns to its default", () => {
    search = "q=rahim";
    const { result } = renderHook(() => useQueryState({ q: "", page: 1 }));
    act(() => result.current[1]({ q: "" }));
    expect(replace).toHaveBeenCalledWith("/admin/teacher/list", { scroll: false });
  });

  it("preserves params it does not own", () => {
    search = "recipients=a,b";
    const { result } = renderHook(() => useQueryState({ q: "", page: 1 }));
    act(() => result.current[1]({ q: "x" }));
    expect(replace).toHaveBeenCalledWith(
      "/admin/teacher/list?recipients=a%2Cb&q=x",
      { scroll: false },
    );
  });
});
