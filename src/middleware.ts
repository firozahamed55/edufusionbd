import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/shared/services/supabase/middleware";
import { ROUTES } from "@/shared/constants/routes";

/** Routes reachable without an authenticated session. */
const PUBLIC_PREFIXES = ["/login", "/otp", "/2fa", "/forgot-password"];

/**
 * Edge chokepoint: refresh session, then guard everything that is not public.
 * Tenant (institution_id) + role checks are layered here and re-enforced by
 * Supabase RLS at the data layer (defense-in-depth).
 */
export async function middleware(request: NextRequest) {
  // Dev preview: without Supabase env configured, skip the auth gate so the
  // UI is browsable out of the box. Real deployments always set this.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.next();
  }

  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.login;
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
