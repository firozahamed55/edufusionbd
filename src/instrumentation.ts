import { reportError } from "@/shared/services/observability";

/**
 * Next 15's server-error funnel. Every uncaught error from a Server Component,
 * route handler, server action, or middleware arrives here — including the ones
 * that never reach a React error boundary because the response died first.
 *
 * This is the file that closes audit item H-4. Before it, a 500 in production
 * was invisible: `error.tsx` only fires for errors that made it into the client
 * React tree, and nothing recorded the rest. An APM SDK does this by patching
 * the runtime; Next exposes the same hook natively, so we use the hook.
 *
 * Kept deliberately thin — it runs on the error path, where the only two failure
 * modes that matter are "logged nothing" and "threw again". No await, no I/O, no
 * conditional logic beyond building the tag.
 */
export function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
): void {
  reportError(err, `${context.routeType}:${context.routePath}`, {
    // `routePath` is the low-cardinality route pattern (`/admin/fee/[id]`) and is
    // the right grouping key. `path` is the concrete URL and can contain a
    // student id, so it is logged for correlation but never used to group.
    path: request.path,
    method: request.method,
    router: context.routerKind,
  });
}
