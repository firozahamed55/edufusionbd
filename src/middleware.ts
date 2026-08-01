import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/shared/services/supabase/middleware";
import { ROUTES } from "@/shared/constants/routes";
import { roleHome } from "@/features/auth/components/roles";
import { buildCsp } from "@/shared/services/csp";

/** Routes reachable without an authenticated session. */
const PUBLIC_PREFIXES = [
  "/login",
  "/otp",
  "/2fa",
  "/forgot-password",
  "/reset-password",
  "/first-login-setup",
  // Certificate verification (SRA A-7 point 6). The person scanning the QR on
  // a transfer certificate is a clerk at the RECEIVING school with no account
  // here — a verification page behind a login verifies nothing. The RPC it
  // calls is uuid-keyed and discloses only what the paper already says.
  "/verify/",
];

/** Roles allowed into the /admin/* app (teacher currently falls back to admin). */
const ADMIN_ROLES = new Set(["admin", "teacher", "super_admin"]);

/**
 * Edge chokepoint: refresh session, guard everything that is not public, then
 * role-gate the admin app. Supabase RLS re-enforces tenant (institution_id)
 * isolation at the data layer (defense-in-depth).
 *
 * Also mints a per-request CSP nonce: stamped on `x-nonce` (read by
 * layout.tsx via next/headers to hand to next-themes' inline bootstrap
 * script) and on the CSP response header itself, so `script-src` never
 * needs `unsafe-inline`.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  // `/api/v1/*` (audit A-H8's server tier) is fetched by client JS, never
  // navigated to. A 307 redirect to an HTML /login page on a missing session
  // silently breaks the caller — `fetch()` follows it and gets HTML where it
  // expected JSON. Every route under here does its own `getUser()` check
  // (see `src/server/sms/sendCampaign.ts`) and returns a real 401, so the
  // redirect below must not apply here.
  const isApiV1 = pathname.startsWith("/api/v1/");

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  request.headers.set("x-nonce", nonce);
  const csp = buildCsp(nonce);

  // Without Supabase env the auth gate cannot run. Allow browsing only in dev;
  // in production fail CLOSED (block everything non-public) so a misconfigured
  // deploy never exposes the app.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    if (process.env.NODE_ENV !== "production" || isPublic) {
      const response = NextResponse.next({ request });
      response.headers.set("Content-Security-Policy", csp);
      return response;
    }
    return NextResponse.redirect(new URL(ROUTES.login, request.url));
  }

  // Public routes never READ `claims` — the guard below is `!claims && !isPublic`,
  // and the role gate only covers /admin and /parent. So doing the auth work here
  // was pure waste on exactly the pages an unauthenticated visitor hits: a
  // Supabase client construction, a JWKS fetch on a cold isolate, and a token
  // refresh round trip if the cookie happened to be near expiry — all discarded.
  //
  // Skipping it also means a session is not refreshed while the user sits on a
  // public page. That is fine: they are not using the app, and the next
  // navigation into /admin or /parent refreshes as normal. (Audit M-6 — a larger
  // saving than the 91.5 kB bundle trim it originally proposed; see §9.6.)
  if (isPublic) {
    const response = NextResponse.next({ request });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  const { response, claims } = await updateSession(request);
  response.headers.set("Content-Security-Policy", csp);

  if (!claims && !isPublic && !isApiV1) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.login;
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Role gate: each app only admits its own roles. Role is read from the signed
  // JWT's `app_metadata` ONLY — that claim is service-role-writable, so the
  // account holder cannot set it. (`user_metadata` IS user-writable and is
  // deliberately not consulted; see shared/services/supabase/middleware.ts.)
  // RLS re-enforces tenant + role at the data layer (defense-in-depth).
  if (claims) {
    const { role } = claims;

    // Only admin-side roles may enter /admin/*. Everyone else goes to their app.
    if (pathname.startsWith("/admin") && (!role || !ADMIN_ROLES.has(role))) {
      const url = request.nextUrl.clone();
      url.pathname = role === "parent" ? "/parent" : ROUTES.login;
      return NextResponse.redirect(url);
    }

    // Only parents may enter /parent/*. An admin/teacher who lands here is sent
    // back to their own dashboard rather than shown an empty parent shell.
    if (pathname.startsWith("/parent") && role !== "parent") {
      const url = request.nextUrl.clone();
      url.pathname = roleHome(role);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // `api/health` is excluded, not merely marked public: an uptime probe must
    // measure "is this deployment serving requests" without doing a JWT verify
    // or a cookie round-trip on every check.
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
