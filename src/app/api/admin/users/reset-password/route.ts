import { NextResponse, type NextRequest } from "next/server";
import { resetPasswordUseCase } from "@/server/users/accountOps";
import { ACCOUNT_OP_STATUS, readOrigin } from "../status";

/**
 * `POST /api/admin/users/reset-password` — send an account a recovery mail
 * (audit S-9.2).
 *
 * On a server route rather than from the browser for one reason: the
 * permission check, the rate limit and the audit row all have to happen, and
 * the address to send to must be looked up under them. `resetPasswordForEmail`
 * itself needs no privileged key.
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

  const result = await resetPasswordUseCase(body, readOrigin(request));
  if (!result.ok) {
    return NextResponse.json(
      { kind: result.kind, message: result.message },
      { status: ACCOUNT_OP_STATUS[result.kind] ?? 500 },
    );
  }
  return NextResponse.json({ email: result.email }, { status: 200 });
}
