/**
 * Auth identity resolution. A Bangladeshi mobile number is the primary login
 * identifier; it maps to a synthetic email so Supabase's email/password flow
 * works uniformly. Anything else is treated as an email. Keep this ONE copy so
 * login and password-reset resolve identifiers identically.
 */
export function resolveLoginEmail(raw: string): string {
  const v = raw.trim();
  const digits = v.replace(/[^\d]/g, "");
  const isPhone = /^(?:\+?880)?1\d{9}$/.test(digits);
  if (isPhone) return `${digits.slice(-11)}@phone.edufusionbd.app`;
  return v;
}

/** Phone-only synthetic identity — has no real inbox, so email reset can't reach it. */
export function isPhoneIdentity(email: string): boolean {
  return email.endsWith("@phone.edufusionbd.app");
}
