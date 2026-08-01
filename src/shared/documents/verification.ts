/**
 * Public verification URLs for printed artefacts (SRA A-7 point 6).
 *
 * Transfer certificates and testimonials are legal-adjacent documents that
 * leave the institution's control the moment they are handed over. The QR on
 * the sheet resolves to a public, unauthenticated page that states only
 * whether that serial exists and what it certifies — enough for a receiving
 * school to check, and not enough to enumerate a roll of students.
 */

export type VerifiableKind = "testimonial" | "transfer" | "admit" | "id";

/** Absolute origin for the printed URL. `NEXT_PUBLIC_SITE_URL` is the deployed
 *  origin; falling back to the current one keeps preview deployments honest. */
export function siteOrigin(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function verificationUrl(kind: VerifiableKind, id: string): string {
  return `${siteOrigin()}/verify/${kind}/${id}`;
}

/**
 * Human-readable serial for a certificate that has no `cert_no` yet.
 *
 * Deliberately derived from the record id rather than minted from a counter:
 * a counter needs a sequence, a transaction and a backfill for every row
 * already issued. The last 8 hex characters of a v4 uuid are 4 billion
 * values — collision-free at the scale of one institution's certificate
 * register, and it is stable, so a reprint carries the same serial.
 */
export function fallbackSerial(id: string): string {
  return id.replace(/-/g, "").slice(-8).toUpperCase();
}
