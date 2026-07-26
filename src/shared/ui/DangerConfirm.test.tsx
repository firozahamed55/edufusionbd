/**
 * This dialog is the only thing standing between a mis-click and permanently
 * voiding thousands of institution-wide records (audit B-2), so its arming
 * logic is worth pinning: confirm stays disabled until the exact count is
 * typed, and a stale confirmation must never carry into the next open.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DangerConfirm } from "./DangerConfirm";

const base = {
  onClose: () => {},
  title: "Delete selected fees?",
  description: "1248 fee invoices will be permanently voided.",
  confirmLabel: "Yes, delete",
  cancelLabel: "Cancel",
  typeToConfirmLabel: (p: string) => `Type ${p} to confirm`,
};

const confirmBtn = () => screen.getByRole("button", { name: "Yes, delete" });

describe("DangerConfirm", () => {
  it("keeps confirm disabled until the exact count is typed", () => {
    const onConfirm = vi.fn();
    render(<DangerConfirm {...base} open onConfirm={onConfirm} count={1248} />);

    expect(confirmBtn()).toBeDisabled();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "124" } });
    expect(confirmBtn()).toBeDisabled();

    fireEvent.change(input, { target: { value: "1248" } });
    expect(confirmBtn()).not.toBeDisabled();

    confirmBtn().click();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("never arms on a zero-row selection, even if '0' is typed", () => {
    render(<DangerConfirm {...base} open onConfirm={vi.fn()} count={0} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "0" } });
    expect(confirmBtn()).toBeDisabled();
  });

  it("clears the typed confirmation when reopened", () => {
    const { rerender } = render(<DangerConfirm {...base} open onConfirm={vi.fn()} count={5} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "5" } });
    expect(confirmBtn()).not.toBeDisabled();

    rerender(<DangerConfirm {...base} open={false} onConfirm={vi.fn()} count={5} />);
    rerender(<DangerConfirm {...base} open onConfirm={vi.fn()} count={5} />);

    // A carried-over confirmation would arm a delete the operator never typed.
    expect(confirmBtn()).toBeDisabled();
  });
});
