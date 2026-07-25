import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/shared/i18n/request.ts");

/**
 * Security headers applied to every response (defense-in-depth alongside RLS).
 * Content-Security-Policy is NOT set here — it's minted per-request in
 * middleware.ts with a fresh nonce (see src/shared/services/csp.ts), since a
 * static config-level header can't carry a per-request nonce value.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    /**
     * Client Router Cache lifetime. THIS IS THE FIX FOR SLUGGISH NAVIGATION.
     *
     * Every route in this app is dynamic (`ƒ` in the build output) because the
     * whole app is behind an auth gate that reads cookies. Next's default
     * `staleTimes.dynamic` is **0**, which means the client router cache is
     * effectively disabled for dynamic routes: navigating back to a screen you
     * left five seconds ago re-fetches its entire RSC payload from the server.
     * Measured at 150–370 ms of pure wait, on every single navigation, with a
     * loading skeleton flashing over it — which is exactly what "toggling
     * between screens isn't smooth" feels like.
     *
     * With a 30 s window, revisiting a recent screen is served from memory and
     * is instant. Forward navigation to a screen not yet visited is unchanged —
     * that still costs a server round trip.
     *
     * Why 30 s is safe here rather than a guess: the RSC payload for these routes
     * is the page shell plus (on prefetching pages) dehydrated query data, and
     * the data layer ALREADY tolerates staleness by design — TanStack Query runs
     * with `staleTime: 60_000`. So this window is strictly tighter than the
     * staleness the app already accepts, and a mutation invalidates its query
     * regardless of what the router cached. Sign-out and `router.refresh()` clear
     * this cache, and the middleware gate still runs on every real navigation, so
     * it is not a way to reach a screen you are no longer authorised for.
     */
    staleTimes: { dynamic: 30, static: 300 },
  },
  images: {
    // Supabase Storage public bucket host is added here once the project is provisioned.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
