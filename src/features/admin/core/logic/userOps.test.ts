/**
 * The invite payload contract (Settings audit M-15, Phase 1.2 QA).
 *
 * WHAT THIS CAN AND CANNOT COVER. The route's real guarantees — a
 * non-`core.user_manage` caller gets 403, the rate limit trips at N, an invited
 * account becomes active on first sign-in — are enforced by `require_permission`,
 * `check_rate_limit` and GoTrue respectively, and none of the three can be
 * exercised without a database and a live auth server. Asserting them here
 * would mean mocking the very thing under test, which proves the mock works.
 * They belong in `supabase/tests/rls_roles.test.sql` (the guard) and in an
 * integration run against a local stack (the rest); this file covers the one
 * layer that is genuinely testable offline and genuinely gets broken by
 * refactors — the schema both sides of the HTTP boundary parse with.
 */
import { describe, it, expect } from "vitest";
import { inviteUserSchema, profileIdSchema } from "./userOps";

const valid = {
  email: "head@school.edu.bd",
  full_name: "Rahima Khatun",
  phone: "01712345678",
  role_ids: [] as string[],
  message: "",
};

describe("inviteUserSchema", () => {
  it("accepts a minimal real invite", () => {
    const parsed = inviteUserSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("lowercases and trims the address, because the DB uniqueness index is on lower(email)", () => {
    const parsed = inviteUserSchema.parse({ ...valid, email: "  Head@School.EDU.BD " });
    expect(parsed.email).toBe("head@school.edu.bd");
  });

  it("rejects a malformed address before a mail is spent on it", () => {
    for (const email of ["", "not-an-email", "a@b", "a b@c.d"]) {
      expect(inviteUserSchema.safeParse({ ...valid, email }).success, email).toBe(false);
    }
  });

  it("requires a name — the invitation mail and the user list both print it", () => {
    expect(inviteUserSchema.safeParse({ ...valid, full_name: "" }).success).toBe(false);
    expect(inviteUserSchema.safeParse({ ...valid, full_name: "R" }).success).toBe(false);
  });

  it("treats an empty phone as absent, and a wrong one as an error", () => {
    // The RPC reads optional fields as nullif(x,''), so "" and absent are the
    // same server-side; a React form only ever holds "".
    expect(inviteUserSchema.parse({ ...valid, phone: "" }).phone).toBeUndefined();
    expect(inviteUserSchema.safeParse({ ...valid, phone: "0121234567" }).success).toBe(false);
    expect(inviteUserSchema.safeParse({ ...valid, phone: "01912345678" }).success).toBe(true);
  });

  it("treats an empty welcome message as absent and caps a long one", () => {
    expect(inviteUserSchema.parse(valid).message).toBeUndefined();
    expect(inviteUserSchema.safeParse({ ...valid, message: "x".repeat(501) }).success).toBe(false);
  });

  it("rejects a role id that is not a uuid, so a forged value never reaches the RPC", () => {
    expect(inviteUserSchema.safeParse({ ...valid, role_ids: ["not-a-uuid"] }).success).toBe(false);
    expect(
      inviteUserSchema.safeParse({ ...valid, role_ids: ["3f2504e0-4f89-11d3-9a0c-0305e82c3301"] }).success,
    ).toBe(true);
  });
});

describe("profileIdSchema", () => {
  it("takes a uuid and nothing else", () => {
    expect(profileIdSchema.safeParse({ profile_id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301" }).success).toBe(true);
    expect(profileIdSchema.safeParse({ profile_id: "" }).success).toBe(false);
    expect(profileIdSchema.safeParse({}).success).toBe(false);
  });
});
