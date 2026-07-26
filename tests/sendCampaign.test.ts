/**
 * `sendCampaignUseCase` — the one write routed through `src/server/` (audit
 * A-H8). Its job is entirely error-shape mapping: validate, call the RPC,
 * turn a raw PostgrestError into a `kind` a route handler can map to an HTTP
 * status. The RPC itself (rate limit, permission, tenant scoping) is proven
 * live against the hosted schema, not here — this is the part that only
 * exists in this file and would otherwise go untested.
 */
import { describe, it, expect, vi } from "vitest";

const rpc = vi.fn();
const getUser = vi.fn();

vi.mock("@/shared/services/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, rpc }),
}));

const { sendCampaignUseCase } = await import("@/server/sms/sendCampaign");

const validPayload = {
  recipient_type: "parent",
  language: "bn",
  body: "Test message",
  recipient_count: 5,
};

describe("sendCampaignUseCase", () => {
  it("rejects an invalid payload before touching the network", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const result = await sendCampaignUseCase({ ...validPayload, body: "" });
    expect(result).toEqual(expect.objectContaining({ ok: false, kind: "validation" }));
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller before calling the RPC", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await sendCampaignUseCase(validPayload);
    expect(result).toEqual(expect.objectContaining({ ok: false, kind: "unauthenticated" }));
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps the rate-limit SQLSTATE to kind: rate_limited", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    rpc.mockResolvedValue({ data: null, error: { code: "RLIM1", message: "rate limit exceeded" } });
    const result = await sendCampaignUseCase(validPayload);
    expect(result).toEqual({ ok: false, kind: "rate_limited", message: "rate limit exceeded" });
  });

  it("maps the permission-guard SQLSTATE to kind: forbidden", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied: sms.send" } });
    const result = await sendCampaignUseCase(validPayload);
    expect(result).toEqual({ ok: false, kind: "forbidden", message: "permission denied: sms.send" });
  });

  it("returns the new campaign id on success", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    rpc.mockResolvedValue({ data: "campaign-123", error: null });
    const result = await sendCampaignUseCase(validPayload);
    expect(result).toEqual({ ok: true, id: "campaign-123" });
  });
});
