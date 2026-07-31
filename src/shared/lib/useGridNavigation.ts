"use client";

import { useCallback, useRef } from "react";
import type { KeyboardEvent } from "react";

/**
 * Arrow-key movement for the two grid screens (SRA A-0.7 / A-5.1).
 *
 * WHY. Marks Entry for a 60-student section is 60 Tab presses with no arrow
 * movement, no Enter-to-next-row and no way back up. Attendance is 60 mouse
 * clicks. These are the two highest-frequency, most time-pressured surfaces in
 * the product — a teacher enters marks against a deadline and a section's
 * attendance every teaching day — and they were the most keyboard-hostile.
 *
 * HOW IT IS WIRED. The grid owns a ref map keyed by `row:col`; each cell
 * registers itself and forwards its `onKeyDown`. No context, no portal, no
 * component wrapper — the screens keep rendering their own markup, which is the
 * same reason `useDataScreen` is a hook rather than a `<DataTable>`.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It is not a full ARIA grid widget
 * (`role="grid"` + roving tabindex). Those screens are forms of real inputs
 * inside a real table, where Tab already means something correct and browsers
 * and screen readers already handle it well. Adding a roving tabindex would
 * take Tab *away* from the operator to satisfy a pattern written for
 * non-input grids. Arrows are additive; Tab still works exactly as before.
 */

export type GridNavigation = {
  /** `ref` callback for a cell. Pass its row and column index. */
  register: (row: number, col: number) => (el: HTMLElement | null) => void;
  /** `onKeyDown` for a cell. Pass its row and column index. */
  onKeyDown: (row: number, col: number) => (e: KeyboardEvent) => void;
};

export function useGridNavigation({ rows, cols }: { rows: number; cols: number }): GridNavigation {
  const cells = useRef(new Map<string, HTMLElement>());

  const key = (row: number, col: number) => `${row}:${col}`;

  const register = useCallback(
    (row: number, col: number) => (el: HTMLElement | null) => {
      if (el) cells.current.set(key(row, col), el);
      else cells.current.delete(key(row, col));
    },
    [],
  );

  const focus = useCallback((row: number, col: number): boolean => {
    const el = cells.current.get(key(row, col));
    if (!el) return false;
    el.focus();
    // Land with the value selected, so typing replaces rather than appends —
    // the whole point of moving down a column is to overwrite each cell.
    if (el instanceof HTMLInputElement && el.type !== "checkbox") el.select();
    return true;
  }, []);

  const onKeyDown = useCallback(
    (row: number, col: number) => (e: KeyboardEvent) => {
      // Never steal a shortcut. Ctrl/Cmd+arrow is "jump to end of line" in every
      // text field on every platform.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const move = (dRow: number, dCol: number) => {
        const nextRow = Math.min(Math.max(row + dRow, 0), rows - 1);
        const nextCol = Math.min(Math.max(col + dCol, 0), cols - 1);
        if (nextRow === row && nextCol === col) return;
        if (focus(nextRow, nextCol)) e.preventDefault();
      };

      switch (e.key) {
        case "ArrowDown":
        // Enter moves down, not to the next cell: a column of marks is entered
        // top to bottom, one student after another.
        case "Enter":
          move(1, 0);
          break;
        case "ArrowUp":
          move(-1, 0);
          break;
        case "ArrowLeft":
        case "ArrowRight": {
          // Inside a text field, left/right belong to the caret unless it is
          // already at the edge. Taking them unconditionally would make it
          // impossible to correct a typo.
          const el = e.target as HTMLInputElement;
          const isText = el instanceof HTMLInputElement && el.type !== "checkbox";
          if (isText) {
            const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
            const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
            if (e.key === "ArrowLeft" && !atStart) return;
            if (e.key === "ArrowRight" && !atEnd) return;
          }
          move(0, e.key === "ArrowLeft" ? -1 : 1);
          break;
        }
        case "Home":
          if (focus(0, col)) e.preventDefault();
          break;
        case "End":
          if (focus(rows - 1, col)) e.preventDefault();
          break;
        default:
          break;
      }
    },
    [rows, cols, focus],
  );

  return { register, onKeyDown };
}
