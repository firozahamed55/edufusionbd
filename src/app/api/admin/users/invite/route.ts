import { NextResponse, type NextRequest } from "next/server";
import { inviteUserUseCase } from "@/server/users/inviteUser";

/**
 * `POST /api/admin/users/invite` — see `src/server/users/inviteUser.ts` for why
 * this write, and only this write in the users feature, needs a route.
 *
 * `runtime: nodejs` (not edge): the session RPCs need the full `@supabase/ssr`
 * cookie flow, and the service-role client must not run anywhere its key could
 * be bundled.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  conflict: 409,
  rate_limited: 429,
  unknown: 500,
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ kind: "validation", message: "Invalid JSON body" }, { status: 400 });
  }

  const result = await inviteUserUseCase(body);
  if (!result.ok) {
    return NextResponse.json(
      { kind: result.kind, message: result.message },
      { status: STATUS[result.kind] ?? 500 },
    );
  }
  return NextResponse.json({ profileId: result.profileId }, { status: 201 });
}
