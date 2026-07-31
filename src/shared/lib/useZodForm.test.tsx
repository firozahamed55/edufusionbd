import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { z } from "zod";
import { useZodForm } from "./useZodForm";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  mobile: z.string().regex(/^01[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile"),
});
type Values = z.input<typeof schema>;
const EMPTY: Values = { name: "", mobile: "" };

const form = () => renderHook(() => useZodForm(schema, EMPTY));

describe("useZodForm", () => {
  it("shows nothing before the operator has touched a field", () => {
    const { result } = form();
    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(false);
  });

  it("does not error on the first keystroke, only on blur", () => {
    const { result } = form();
    act(() => result.current.setValue("mobile", "01"));
    expect(result.current.errors.mobile).toBeUndefined();
    act(() => result.current.touch("mobile"));
    expect(result.current.errors.mobile).toBe("Enter a valid Bangladeshi mobile");
  });

  it("reveals every error on submit and returns null", () => {
    const { result } = form();
    let out: unknown = "unset";
    act(() => { out = result.current.submit(); });
    expect(out).toBeNull();
    expect(result.current.errors).toEqual({
      name: "Name is required",
      mobile: "Enter a valid Bangladeshi mobile",
    });
  });

  it("returns the parsed value once valid", () => {
    const { result } = form();
    act(() => result.current.patch({ name: "Rahim", mobile: "01712345678" }));
    expect(result.current.isValid).toBe(true);
    let out: unknown;
    act(() => { out = result.current.submit(); });
    expect(out).toEqual({ name: "Rahim", mobile: "01712345678" });
    expect(result.current.errors).toEqual({});
  });

  it("tracks dirtiness against the initial snapshot", () => {
    const { result } = form();
    expect(result.current.isDirty).toBe(false);
    act(() => result.current.setValue("name", "Rahim"));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.setValue("name", ""));
    expect(result.current.isDirty).toBe(false);
  });

  it("clears touched, submitted and dirty state on reset", () => {
    const { result } = form();
    act(() => { result.current.submit(); });
    expect(Object.keys(result.current.errors)).toHaveLength(2);
    act(() => result.current.reset());
    expect(result.current.errors).toEqual({});
    expect(result.current.isDirty).toBe(false);
  });

  it("adopts a new baseline when reset is given values", () => {
    const { result } = form();
    act(() => result.current.reset({ name: "Karim", mobile: "01812345678" }));
    expect(result.current.isDirty).toBe(false);
    act(() => result.current.setValue("name", "Rahim"));
    expect(result.current.isDirty).toBe(true);
  });

  it("attaches a server rejection to its field and clears it on edit", () => {
    const { result } = form();
    act(() => result.current.patch({ name: "Rahim", mobile: "01712345678" }));
    act(() => result.current.setServerErrors({ name: "That name already exists" }));
    expect(result.current.errors.name).toBe("That name already exists");
    act(() => result.current.setValue("name", "Rahim Uddin"));
    expect(result.current.errors.name).toBeUndefined();
  });

  it("shows one message per field even when several rules fail", () => {
    const multi = z.object({ code: z.string().min(3, "Too short").regex(/^\d+$/, "Digits only") });
    const { result } = renderHook(() => useZodForm(multi, { code: "" }));
    act(() => { result.current.submit(); });
    expect(result.current.errors.code).toBe("Too short");
  });
});
