import type { NextRequest } from "next/server";

/**
 * The two things all three account-operation routes share, kept out of each of
 * them so a fourth cannot invent a third status table.
 */

/** Failure vocabulary → HTTP status. Mirrors `api/v1/sms/send`'s table. */
export const ACCOUNT_OP_STATUS: Record<string, number> = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  duplicate: 409,
  rate_limited: 429,
  unknown: 500,
};

/**
 * Where the invitation and recovery links should point back to.
 *
 * The request's own origin, not a build-time constant: every preview
 * deployment has a different host, and a mail whose link lands on production
 * from a preview invite is a confusing bug to receive. `NEXT_PUBLIC_SITE_URL`
 * is the fallback for a request that arrives without a usable URL, matching
 * what `shared/documents/verification.ts` already does for printed links.
 */
export function readOrigin(request: NextRequest): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "";
  }
}
