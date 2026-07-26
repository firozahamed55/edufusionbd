"use client";

/**
 * Screen-reader announcer for async outcomes (audit A-5 — the whole app had 3
 * `aria-live` regions, so loading→loaded transitions, result counts and save
 * confirmations were silent to a screen reader on nearly every screen).
 *
 * Visually hidden, always mounted. It must exist in the DOM *before* the text
 * changes for the change to be announced, which is why it renders an empty
 * region rather than mounting only when there is a message.
 */
export function LiveRegion({
  message,
  assertive = false,
}: {
  message: string;
  /** Use for errors that interrupt; default polite waits for a pause. */
  assertive?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
