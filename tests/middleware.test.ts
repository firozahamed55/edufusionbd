/**
 * The auth gate, as an executable test.
 *
 * WHY THIS AND NOT PLAYWRIGHT. The audit's H-3 asked for Playwright smokes over
 * the three auth flows. What those smokes would actually be protecting is one
 * pure function: `middleware()` decides, for every request in this product,
 * whether it is allowed and where it is redirected. A browser driver would
 * exercise that function through a real login, a real network and a real Supabase
 * — three sources of flake, minutes of runtime, a ~400 MB browser download in CI,
 * and no additional coverage of the decision itself.
 *
 * So the decision table is tested directly and the Supabase round trip is
 * stubbed. That keeps the gate's invariants in the unit suite, where they run in
 * milliseconds on every commit. Playwright is still the right tool for "does the
 * login FORM work end to end" and is tracked as such — it is not a substitute
 * for, nor substituted by, this file.
 *
 * These cases are security assertions. If one fails, do not adjust the test.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getClaims = vi.fn();

// Stub only the Supabase hop. Everything the gate actually decides — public
// prefixes, the role table, redirect targets, the CSP header, the matcher — is
// the real implementation under test.
vi.mock("@/shared/services/supabase/middleware", () => ({
  updateSession: async (request: NextRequest) => {
    const { NextResponse } = await import("next/server");
    return { response: NextResponse.next({ request }), claims: getClaims() };
  },
}));

const { middleware, config } = await import("@/middleware");

// The gate's Supabase hop is mocked above; `roleFromClaims` is the real thing.
const { roleFromClaims } = await vi.importActual<
  typeof import("@/shared/services/supabase/middleware")
>("@/shared/services/supabase/middleware");

const req = (path: string) => new NextRequest(new URL(`https://school.test${path}`));

/** Signed-in as `role`; `null` role = authenticated but no role claim. */
function signedIn(role: string | null) {
  getClaims.mockReturnValue({ sub: "user-1", role: role ?? undefined });
}
function signedOut() {
  getClaims.mockReturnValue(null);
}

beforeEach(() => {
  getClaims.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
});

describe("unauthenticated requests", () => {
  it.each([
    "/admin/dashboard",
    "/admin/fee/quick-collection-list",
    "/parent",
    "/parent/results",
  ])("redirects %s to /login", async (path) => {
    signedOut();
    const res = await middleware(req(path));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("does NOT redirect /api/v1/* — lets the route handler answer with its own JSON status", async () => {
    signedOut();
    const res = await middleware(req("/api/v1/sms/send"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it.each([
    "/api/admin/users/invite",
    "/api/admin/users/reset-password",
    "/api/admin/users/revoke-sessions",
  ])("does NOT redirect %s either", async (path) => {
    // Settings audit M-15. These three arrived outside the `/api/v1/` prefix
    // the exemption was written against, so a signed-out `fetch()` would have
    // followed a 307 to the HTML login page and reported a JSON parse error
    // instead of the 401 the route already knows how to return.
    signedOut();
    const res = await middleware(req(path));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("preserves the requested path as ?redirect= so login can return there", async () => {
    signedOut();
    const res = await middleware(req("/admin/student/list"));
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("redirect")).toBe("/admin/student/list");
  });

  it.each(["/", "/login", "/otp", "/forgot-password", "/reset-password", "/first-login-setup"])(
    "lets %s through",
    async (path) => {
      signedOut();
      const res = await middleware(req(path));
      expect(res.status).toBe(200);
    },
  );
});

describe("public routes skip the auth round trip (audit M-6)", () => {
  it.each(["/", "/login", "/forgot-password"])("does no session work for %s", async (path) => {
    signedIn("admin");
    const res = await middleware(req(path));
    expect(res.status).toBe(200);
    // The saving IS the assertion: if this starts being called again, the
    // optimisation has been silently reverted.
    expect(getClaims).not.toHaveBeenCalled();
  });

  it("still does session work for guarded routes", async () => {
    signedIn("admin");
    await middleware(req("/admin/dashboard"));
    expect(getClaims).toHaveBeenCalled();
  });

  it("still sets the CSP header on public routes", async () => {
    signedOut();
    const res = await middleware(req("/login"));
    expect(res.headers.get("Content-Security-Policy")).toMatch(/script-src[^;]*'nonce-/);
  });
});

describe("role gate", () => {
  it.each(["admin", "teacher", "super_admin"])("admits %s to /admin", async (role) => {
    signedIn(role);
    expect((await middleware(req("/admin/dashboard"))).status).toBe(200);
  });

  it("sends a parent who reaches /admin to /parent, not to /login", async () => {
    signedIn("parent");
    const res = await middleware(req("/admin/dashboard"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/parent");
  });

  it("sends an admin who reaches /parent back to their own dashboard", async () => {
    signedIn("admin");
    const res = await middleware(req("/parent"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/admin/dashboard");
  });

  it("treats a session with NO role claim as unprivileged, not as an admin", async () => {
    // The fail-open shape of this bug is the dangerous one: a user whose
    // app_metadata.role was never set must not inherit the admin app.
    signedIn(null);
    const res = await middleware(req("/admin/dashboard"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("admits a parent to /parent", async () => {
    signedIn("parent");
    expect((await middleware(req("/parent"))).status).toBe(200);
  });
});

describe("misconfigured deploy (no Supabase env)", () => {
  it("fails CLOSED in production", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    vi.stubEnv("NODE_ENV", "production");
    const res = await middleware(req("/admin/dashboard"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    vi.unstubAllEnvs();
  });

  it("still serves public routes when it fails closed", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    vi.stubEnv("NODE_ENV", "production");
    expect((await middleware(req("/login"))).status).toBe(200);
    vi.unstubAllEnvs();
  });
});

describe("CSP", () => {
  it("sets a nonce-based script-src with no unsafe-inline", async () => {
    signedIn("admin");
    const csp = (await middleware(req("/admin/dashboard"))).headers.get("Content-Security-Policy");
    expect(csp).toMatch(/script-src[^;]*'nonce-/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("mints a fresh nonce per request", async () => {
    signedIn("admin");
    const a = (await middleware(req("/admin/dashboard"))).headers.get("Content-Security-Policy");
    const b = (await middleware(req("/admin/dashboard"))).headers.get("Content-Security-Policy");
    expect(a).not.toBe(b);
  });
});

describe("role claim source (A-C2)", () => {
  // `roleFromClaims` is the ONLY place a role enters the gate. `user_metadata`
  // is writable by the account holder, so honouring it there would be a
  // one-line self-promotion to super_admin. These are security assertions.
  it("reads the role from app_metadata", () => {
    expect(roleFromClaims({ app_metadata: { role: "admin" } })).toBe("admin");
  });

  it("IGNORES a role in user_metadata", () => {
    expect(roleFromClaims({ user_metadata: { role: "super_admin" } })).toBeUndefined();
  });

  it("does not let user_metadata override or fill in for app_metadata", () => {
    expect(
      roleFromClaims({ app_metadata: {}, user_metadata: { role: "super_admin" } }),
    ).toBeUndefined();
    expect(
      roleFromClaims({
        app_metadata: { role: "parent" },
        user_metadata: { role: "super_admin" },
      }),
    ).toBe("parent");
  });

  it("rejects a non-string app_metadata role", () => {
    expect(roleFromClaims({ app_metadata: { role: { toString: () => "admin" } } })).toBeUndefined();
  });
});

describe("matcher", () => {
  const matcher = config.matcher[0];
  const matches = (path: string) => new RegExp(`^${matcher}$`).test(path);

  it("excludes /api/health so the uptime probe does no JWT work", () => {
    expect(matches("/api/health")).toBe(false);
  });

  it("still covers the app routes", () => {
    expect(matches("/admin/dashboard")).toBe(true);
    expect(matches("/parent")).toBe(true);
  });

  it("excludes static assets", () => {
    expect(matches("/_next/static/chunk.js")).toBe(false);
    expect(matches("/logo.png")).toBe(false);
  });
});
