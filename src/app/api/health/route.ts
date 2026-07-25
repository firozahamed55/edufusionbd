import { NextResponse } from "next/server";

/**
 * Uptime probe. Point the external monitor here, not at `/`.
 *
 * Deliberately shallow: it answers "is this deployment serving requests", not
 * "is the database healthy". A probe that hits Postgres on every check turns an
 * uptime monitor into a traffic source and — worse — makes a transient DB blip
 * page you for a web tier that is actually fine. Supabase already reports its
 * own availability. Keep the two signals separate.
 *
 * Returns 200 unconditionally; if the process is down, the monitor's timeout is
 * the signal. `runtime: nodejs` (not edge) so this reflects the same runtime
 * the app's server components run in.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      // Set by Vercel; undefined locally. Lets you confirm WHICH build answered.
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      // Not cached — see headers below — so this is the time of the probe.
      time: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
