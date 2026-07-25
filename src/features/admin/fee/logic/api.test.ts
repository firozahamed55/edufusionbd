/**
 * The money boundary. These assertions describe failures that cost a school
 * actual taka, so they are written against the behaviour, not the implementation.
 */
import { describe, it, expect } from "vitest";
import { collectPayloadSchema, feeMappingSchema } from "./api";

const INV = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const ACC = "9f8b7a6c-1d2e-4f30-8a91-2b3c4d5e6f70";

describe("collectPayloadSchema", () => {
  it("accepts a minimal cash collection", () => {
    expect(collectPayloadSchema.safeParse({ fee_invoice_id: INV, amount: "500", method: "cash" }).success).toBe(true);
  });

  it("rejects a renamed key instead of silently posting against nothing", () => {
    // `payload->>'fee_invoice_id'` returns NULL for a key that isn't there, and the
    // RPC would raise 'invoice not found' — but only after the operator watched a
    // spinner. `.strict()` catches the typo at the call site.
    const r = collectPayloadSchema.safeParse({ invoice_id: INV, amount: "500", method: "cash" });
    expect(r.success).toBe(false);
  });

  it("rejects a grouped amount", () => {
    expect(collectPayloadSchema.safeParse({ fee_invoice_id: INV, amount: "1,200", method: "cash" }).success).toBe(false);
  });

  it("rejects a zero or negative collection", () => {
    for (const amount of ["0", "-100"]) {
      expect(collectPayloadSchema.safeParse({ fee_invoice_id: INV, amount, method: "cash" }).success).toBe(false);
    }
  });

  it("rejects an unknown payment method", () => {
    // `fn_collect_fee` only defaults an EMPTY method — an unrecognised one is
    // stored as-is and then missing from every by-method collection report.
    expect(collectPayloadSchema.safeParse({ fee_invoice_id: INV, amount: "500", method: "upay" }).success).toBe(false);
  });

  it("carries the optional gateway fields through", () => {
    const r = collectPayloadSchema.parse({
      fee_invoice_id: INV, amount: "500.25", method: "bkash", account_id: ACC, txn_ref: "TX99", paid_by: "Guardian",
    });
    expect(r).toMatchObject({ account_id: ACC, txn_ref: "TX99", method: "bkash" });
  });
});

describe("feeMappingSchema", () => {
  it("accepts a class-wide fee", () => {
    expect(
      feeMappingSchema.safeParse({
        class_id: INV, fee_head_id: ACC, amount: "1500", frequency: "monthly", is_active: true,
      }).success,
    ).toBe(true);
  });

  it("rejects a bad amount — this one sets the price for a whole class", () => {
    expect(
      feeMappingSchema.safeParse({
        class_id: INV, fee_head_id: ACC, amount: "1,500", frequency: "monthly", is_active: true,
      }).success,
    ).toBe(false);
  });
});
