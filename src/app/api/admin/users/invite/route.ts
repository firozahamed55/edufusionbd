import { NextResponse, type NextRequest } from "next/server";
import { inviteUserUseCase } from "@/server/users/accountOps";
import { ACCOUNT_OP_STATUS, readOrigin } from "../status";

/**
 * `POST /api/admin/users/invite` — the route the whole authorization model has
 * been waiting on (audit M-15). See `src/server/users/accountOps.ts` for why
 * this write, and only this one of the three, genuinely needs a server tier.
 *
 * `runtime: nodejs` (not edge): the guarded RPCs run on the caller's session,
 * which needs the full `@supabase/ssr` cookie flow.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ kind: "validation", message: "Invalid JSON body" }, { status: 400 });
  }

  const result = await inviteUserUseCase(body, readOrigin(request));
  if (!result.ok) {
    return NextResponse.json(
      { kind: result.kind, message: result.message },
      { status: ACCOUNT_OP_STATUS[result.kind] ?? 500 },
    );
  }
  return NextResponse.json({ profile_id: result.profile_id, resend: result.resend }, { status: 201 });
}
