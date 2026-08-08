/**
 * The diff replaces two `<pre>` dumps that made "which of forty keys changed"
 * a manual read (settings audit S-11.3). Its one subtle contract is that it
 * trusts `changedKeys` over its own comparison — because redacted values are
 * masked identically in `before` and `after`, and a diff that concluded
 * "unchanged" from `••• === •••` would be confidently wrong about the fields
 * that matter most.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { JsonDiff } from "./JsonDiff";

const labels = {
  changed: "What changed",
  unchanged: (c: number) => `${c} unchanged fields`,
  nothing: "No fields changed",
  redacted: "hidden",
  added: "added",
  removed: "removed",
};

describe("JsonDiff", () => {
  it("shows a masked field as changed when the server says it changed", () => {
    render(
      <JsonDiff
        before={{ phone: "•••", full_name: "Rahim" }}
        after={{ phone: "•••", full_name: "Rahim" }}
        changedKeys={["phone"]}
        redactedKeys={["phone"]}
        labels={labels}
      />,
    );
    // `phone` is in the changed list even though both rendered values are the
    // mask — this is the whole reason `changedKeys` is computed server-side.
    expect(screen.getByText("phone")).toBeInTheDocument();
    expect(screen.getByText("hidden")).toBeInTheDocument();
    expect(screen.getByText("1 unchanged fields")).toBeInTheDocument();
  });

  it("labels a key that only exists on one side as added or removed", () => {
    render(
      <JsonDiff
        before={{ a: 1 }}
        after={{ a: 1, b: 2 }}
        changedKeys={["b"]}
        labels={labels}
      />,
    );
    expect(screen.getByText("added")).toBeInTheDocument();

    render(
      <JsonDiff before={{ a: 1, b: 2 }} after={{ a: 1 }} changedKeys={["b"]} labels={labels} />,
    );
    expect(screen.getByText("removed")).toBeInTheDocument();
  });

  it("says so when nothing changed, and when there is nothing at all", () => {
    render(<JsonDiff before={{ a: 1 }} after={{ a: 1 }} changedKeys={[]} labels={labels} />);
    expect(screen.getAllByText("No fields changed").length).toBeGreaterThan(0);

    render(<JsonDiff before={null} after={null} changedKeys={[]} labels={labels} />);
    expect(screen.getAllByText("No fields changed").length).toBeGreaterThan(0);
  });

  it("renders null and empty string as an em dash rather than as 'null'", () => {
    render(<JsonDiff before={{ a: null }} after={{ a: "x" }} changedKeys={["a"]} labels={labels} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
