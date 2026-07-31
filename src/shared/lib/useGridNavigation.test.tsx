import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useGridNavigation } from "./useGridNavigation";

// `fireEvent` rather than `user-event`: the hook's entire contract is what it
// does with a keydown, and user-event is a dependency this repo does not have.
// ponytail: no new devDependency to test a keyboard handler.

/** A 3x2 grid of text inputs, wired exactly as Marks Entry wires it. */
function Grid({ rows = 3, cols = 2 }: { rows?: number; cols?: number }) {
  const nav = useGridNavigation({ rows, cols });
  return (
    <table>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((__, c) => (
              <td key={c}>
                <input
                  aria-label={`r${r}c${c}`}
                  defaultValue={`${r}${c}`}
                  ref={nav.register(r, c)}
                  onKeyDown={nav.onKeyDown(r, c)}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const cell = (r: number, c: number) => screen.getByLabelText(`r${r}c${c}`) as HTMLInputElement;

/** Focus a cell and put the caret where the test needs it. */
function focusAt(r: number, c: number, caret?: number) {
  const el = cell(r, c);
  el.focus();
  if (caret !== undefined) el.setSelectionRange(caret, caret);
  return el;
}

describe("useGridNavigation", () => {
  it("moves down and up a column", () => {
    render(<Grid />);
    fireEvent.keyDown(focusAt(0, 0), { key: "ArrowDown" });
    expect(cell(1, 0)).toHaveFocus();
    fireEvent.keyDown(cell(1, 0), { key: "ArrowUp" });
    expect(cell(0, 0)).toHaveFocus();
  });

  it("treats Enter as next-row — a column of marks is entered top to bottom", () => {
    render(<Grid />);
    fireEvent.keyDown(focusAt(0, 1), { key: "Enter" });
    expect(cell(1, 1)).toHaveFocus();
  });

  it("selects the landed value so typing overwrites", () => {
    render(<Grid />);
    fireEvent.keyDown(focusAt(0, 0), { key: "ArrowDown" });
    const landed = cell(1, 0);
    expect(landed).toHaveFocus();
    expect(landed.selectionStart).toBe(0);
    expect(landed.selectionEnd).toBe(landed.value.length);
  });

  it("stops at the edges instead of wrapping", () => {
    render(<Grid />);
    fireEvent.keyDown(focusAt(0, 0), { key: "ArrowUp" });
    expect(cell(0, 0)).toHaveFocus();
    fireEvent.keyDown(focusAt(2, 0), { key: "ArrowDown" });
    expect(cell(2, 0)).toHaveFocus();
  });

  it("jumps to the first and last row with Home/End", () => {
    render(<Grid />);
    fireEvent.keyDown(focusAt(1, 0), { key: "End" });
    expect(cell(2, 0)).toHaveFocus();
    fireEvent.keyDown(cell(2, 0), { key: "Home" });
    expect(cell(0, 0)).toHaveFocus();
  });

  it("leaves left/right to the caret until it reaches an edge", () => {
    render(<Grid />);
    // Caret mid-value: ArrowLeft belongs to the caret, or a typo could never
    // be corrected.
    fireEvent.keyDown(focusAt(0, 1, 1), { key: "ArrowLeft" });
    expect(cell(0, 1)).toHaveFocus();
  });

  it("crosses columns once the caret is at an edge", () => {
    render(<Grid />);
    fireEvent.keyDown(focusAt(0, 0, 2), { key: "ArrowRight" });
    expect(cell(0, 1)).toHaveFocus();

    fireEvent.keyDown(focusAt(0, 1, 0), { key: "ArrowLeft" });
    expect(cell(0, 0)).toHaveFocus();
  });

  it("never steals a modifier shortcut", () => {
    render(<Grid />);
    fireEvent.keyDown(focusAt(0, 0), { key: "ArrowDown", ctrlKey: true });
    expect(cell(0, 0)).toHaveFocus();
    fireEvent.keyDown(focusAt(0, 0), { key: "ArrowDown", metaKey: true });
    expect(cell(0, 0)).toHaveFocus();
  });

  it("survives the grid shrinking under it", () => {
    // A section changes and the roster gets shorter. Rows that unmounted
    // deregister via the ref callback, so nothing tries to focus a detached
    // node — the operator just stays where they are.
    const { rerender } = render(<Grid rows={3} />);
    rerender(<Grid rows={1} />);
    fireEvent.keyDown(focusAt(0, 0), { key: "ArrowDown" });
    expect(cell(0, 0)).toHaveFocus();
    expect(screen.queryByLabelText("r1c0")).toBeNull();
  });
});
