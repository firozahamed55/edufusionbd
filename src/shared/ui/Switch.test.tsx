import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Switch } from "./Switch";

/**
 * Settings audit A-1 / A-2 — Phase 3 QA.
 *
 * The five toggles this replaces announced as "button" with no state, and one
 * of them announced with no name either. Each case here is one half of that
 * defect, asserted through the accessibility tree rather than through the
 * markup — `getByRole("switch", { name })` fails for exactly the reasons a
 * screen reader would.
 *
 * `fireEvent`, not `user-event`: that is not a dependency of this repo (see
 * the same note in `useGridNavigation.test.tsx`).
 */
describe("Switch", () => {
  it("has the switch role, so it is not announced as a plain button", () => {
    render(<Switch checked={false} onChange={() => {}} label="Parent SMS notifications" />);
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("carries its state, which the old toggle never did in either position", () => {
    const { rerender } = render(<Switch checked={false} onChange={() => {}} label="Parent SMS" />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    rerender(<Switch checked onChange={() => {}} label="Parent SMS" />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("is named by its label — the A-2 defect was a <label> wrapping a <button>", () => {
    render(<Switch checked onChange={() => {}} label="Active" />);
    expect(screen.getByRole("switch", { name: "Active" })).toBeInTheDocument();
  });

  it("associates the supporting line rather than leaving it floating beside the control", () => {
    render(
      <Switch
        checked={false}
        onChange={() => {}}
        label="Online fee payment"
        description="bKash, Nagad & card gateways"
      />,
    );
    expect(screen.getByRole("switch")).toHaveAccessibleDescription("bKash, Nagad & card gateways");
  });

  it("is a real <button>, which is what makes Space and Enter work without any handler", () => {
    // jsdom does not implement the platform's Space/Enter-activates-a-button
    // behaviour, so asserting the keypress would test jsdom. Asserting the
    // element type asserts the reason the behaviour exists.
    render(<Switch checked={false} onChange={() => {}} label="Active" />);
    expect(screen.getByRole("switch").tagName).toBe("BUTTON");
    expect(screen.getByRole("switch")).toHaveAttribute("type", "button");
  });

  it("reports the value it is moving to, not the one it is leaving", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Active" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not fire when disabled", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Active" disabled />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
