import { NextResponse, type NextRequest } from "next/server";
import { sendCampaignUseCase } from "@/server/sms/sendCampaign";

/**
 * `POST /api/v1/sms/send` — see `src/server/sms/sendCampaign.ts` for why this
 * write, and only this write, is routed through a handler instead of calling
 * `supabase.rpc()` from the browser.
 *
 * `runtime: nodejs` (not edge): the RPC call needs the full `@supabase/ssr`
 * cookie-session flow, same as every Server Component in this app.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS: Record<string, number> = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
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

  const result = await sendCampaignUseCase(body);
  if (!result.ok) {
    return NextResponse.json(
      { kind: result.kind, message: result.message },
      { status: STATUS[result.kind] ?? 500 },
    );
  }
  return NextResponse.json({ id: result.id }, { status: 201 });
}
