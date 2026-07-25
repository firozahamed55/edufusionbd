import { describe, it, expect } from "vitest";
import {
  amountString,
  isoDate,
  optionalText,
  optionalUuid,
  paymentMethod,
  uuid,
} from "./validation";
import { PAYMENT_METHOD } from "@/shared/constants/enums";

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  schema.safeParse(v).success;

describe("amountString", () => {
  it("accepts taka and paisa", () => {
    expect(ok(amountString, "1200")).toBe(true);
    expect(ok(amountString, "1200.5")).toBe(true);
    expect(ok(amountString, "1200.50")).toBe(true);
  });

  it("rejects the grouped form a clerk actually types", () => {
    // This is the whole reason the schema exists: "1,200" reaches Postgres as
    // `invalid input syntax for type numeric` and the payment silently fails.
    expect(ok(amountString, "1,200")).toBe(false);
  });

  it("rejects non-positive and non-numeric amounts", () => {
    expect(ok(amountString, "0")).toBe(false);
    expect(ok(amountString, "-50")).toBe(false);
    expect(ok(amountString, "")).toBe(false);
    expect(ok(amountString, "abc")).toBe(false);
    expect(ok(amountString, "12.345")).toBe(false); // sub-paisa precision
  });
});

describe("uuid", () => {
  it("rejects the two values that actually leak through in practice", () => {
    expect(ok(uuid, "")).toBe(false);
    expect(ok(uuid, "undefined")).toBe(false);
  });

  it("accepts a real id", () => {
    expect(ok(uuid, "3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
  });
});

describe("optional fields mirror the RPCs' nullif(x,'')", () => {
  it("treats an empty select as absent, not as invalid", () => {
    expect(optionalUuid.parse("")).toBeUndefined();
    expect(optionalText(10).parse("")).toBeUndefined();
  });

  it("still rejects a malformed non-empty value", () => {
    expect(ok(optionalUuid, "not-an-id")).toBe(false);
    expect(ok(optionalText(3), "too long")).toBe(false);
  });
});

describe("isoDate", () => {
  it("accepts YYYY-MM-DD and rejects the local convention", () => {
    expect(ok(isoDate, "2026-07-25")).toBe(true);
    expect(ok(isoDate, "25/07/2026")).toBe(false);
  });
});

describe("paymentMethod", () => {
  it("rejects an unrecognised method", () => {
    expect(ok(paymentMethod, "upay")).toBe(false);
  });

  // The drift guard. `PAYMENT_METHOD` (UI labels) and `paymentMethod` (the wire
  // allowlist) are two lists of the same thing; adding a gateway to one and not
  // the other either hides it from the form or has the RPC store a value no
  // report groups on. Cheaper than deriving one from the other, and louder.
  it("matches the PAYMENT_METHOD constant the form renders", () => {
    for (const m of PAYMENT_METHOD) expect(ok(paymentMethod, m.value)).toBe(true);
    expect(paymentMethod.options).toHaveLength(PAYMENT_METHOD.length);
  });
});
