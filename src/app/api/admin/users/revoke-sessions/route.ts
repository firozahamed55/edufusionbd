import { NextResponse, type NextRequest } from "next/server";
import { revokeSessionsUseCase } from "@/server/users/accountOps";
import { ACCOUNT_OP_STATUS } from "../status";

/**
 * `POST /api/admin/users/revoke-sessions` — end every live session of another
 * account in this institution (audit S-9.2).
 *
 * No origin needed: nothing here sends mail.
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

  const result = await revokeSessionsUseCase(body);
  if (!result.ok) {
    return NextResponse.json(
      { kind: result.kind, message: result.message },
      { status: ACCOUNT_OP_STATUS[result.kind] ?? 500 },
    );
  }
  return NextResponse.json({ revoked: result.revoked }, { status: 200 });
}
