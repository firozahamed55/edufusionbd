import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDraft } from "./useDraft";

const KEY = "marks:e1:s1:sub1";
const STORAGE_KEY = `efb:draft:${KEY}`;

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("useDraft", () => {
  it("persists the value after the debounce, not before", () => {
    renderHook(() => useDraft(KEY, { a: 1 }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).data).toEqual({ a: 1 });
  });

  it("offers a saved draft rather than applying it silently", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), data: { a: 9 } }));
    const { result } = renderHook(() => useDraft(KEY, { a: 1 }));
    expect(result.current.pending).toEqual({ a: 9 });
    let taken: unknown;
    act(() => { taken = result.current.accept(); });
    expect(taken).toEqual({ a: 9 });
    expect(result.current.pending).toBeNull();
  });

  it("does not re-offer a draft the operator already dismissed", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), data: { a: 9 } }));
    const { result, rerender } = renderHook(() => useDraft(KEY, { a: 1 }));
    act(() => result.current.discard());
    rerender();
    expect(result.current.pending).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("ignores a draft older than a day", () => {
    const old = Date.now() - 25 * 60 * 60 * 1000;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: old, data: { a: 9 } }));
    const { result } = renderHook(() => useDraft(KEY, { a: 1 }));
    expect(result.current.pending).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("survives a corrupt draft instead of breaking the screen", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    const { result } = renderHook(() => useDraft(KEY, { a: 1 }));
    expect(result.current.pending).toBeNull();
  });

  it("does nothing at all without a key", () => {
    renderHook(() => useDraft(null, { a: 1 }));
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(window.localStorage.length).toBe(0);
  });

  it("skips persisting while disabled", () => {
    renderHook(() => useDraft(KEY, { a: 1 }, false));
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("clear removes the stored draft", () => {
    const { result } = renderHook(() => useDraft(KEY, { a: 1 }));
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    act(() => result.current.clear());
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
