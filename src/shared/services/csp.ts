const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy, built fresh per request with the given nonce.
 * `script-src` no longer needs `unsafe-inline`: Next's own inline scripts and
 * next-themes' pre-paint bootstrap script are both stamped with this nonce.
 * `style-src` keeps `unsafe-inline` — Tailwind/Next inject inline styles too
 * broadly to nonce individually; not in scope for this pass.
 */
export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data:",
    `connect-src 'self' https://*.supabase.co${isDev ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
