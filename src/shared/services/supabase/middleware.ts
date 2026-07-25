import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/shared/types/database.types";

/** The subset of the JWT the edge gate needs: identity + role. */
export type SessionClaims = { sub: string; role?: string };

/**
 * Refresh the Supabase session on every request and return the verified claims.
 *
 * Uses `getClaims()` rather than `getUser()`: this project signs JWTs with an
 * asymmetric ES256 key, so the signature is verified locally via WebCrypto
 * against a cached JWKS — no auth-server round trip. `getUser()` cost a measured
 * ~150ms (p99 ~870ms) on EVERY request, including RSC prefetches, which put that
 * latency directly on the critical path of every navigation. Security is
 * unchanged: the signature is still cryptographically verified, and RLS
 * re-enforces tenant isolation at the data layer.
 *
 * Session refresh still happens — `getClaims()` refreshes an access token that
 * is about to expire before validating it, and the cookie handlers below write
 * the rotated tokens back onto the response.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; claims: SessionClaims | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  return {
    response,
    claims: claims
      ? {
          sub: claims.sub,
          role: (claims.app_metadata?.role ?? claims.user_metadata?.role) as
            | string
            | undefined,
        }
      : null,
  };
}
