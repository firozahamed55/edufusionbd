import { describe, it, expect } from "vitest";
import { inviteUserSchema } from "./users";

const ROLE = "3f1b2c4d-0000-4000-8000-000000000001";
const valid = { full_name: "Rahim Uddin", email: "Rahim@School.Test", phone: "01712345678", role_ids: [ROLE] };

describe("inviteUserSchema", () => {
  it("accepts a complete invitation and normalises the email", () => {
    const r = inviteUserSchema.safeParse(valid);
    expect(r.success).toBe(true);
    // Lower-cased before it reaches `fn_invite_user_precheck`, whose duplicate
    // check is on `lower(email)` — otherwise the same person can be invited
    // twice with different capitalisation.
    if (r.success) expect(r.data.email).toBe("rahim@school.test");
  });

  it("treats an omitted phone as absent, not as an empty string", () => {
    const r = inviteUserSchema.safeParse({ ...valid, phone: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBeUndefined();
  });

  it("rejects an invitation with no role", () => {
    // The failure this prevents: an account that signs in, reaches the admin
    // shell, and finds every query empty — indistinguishable from a broken app.
    const r = inviteUserSchema.safeParse({ ...valid, role_ids: [] });
    expect(r.success).toBe(false);
  });

  it("rejects a malformed email and a malformed mobile", () => {
    expect(inviteUserSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(inviteUserSchema.safeParse({ ...valid, phone: "12345" }).success).toBe(false);
  });
});
