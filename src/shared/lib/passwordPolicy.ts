/**
 * The one password policy in the product (SRA B-5).
 *
 * "No strength meter, no stated requirements, no breach check surfaced." Reset
 * Password had a 0–3 heuristic of its own; Change Password and First-Login had
 * nothing, so the same account could be given a password one screen would have
 * rejected. The rules live here so all three agree, and so the checklist the
 * user reads is generated from the same predicate that gates the button.
 *
 * The minimum matches Supabase's own `password_min_length` default of 8. The
 * breach check is NOT reimplemented here: Supabase's leaked-password
 * protection (HaveIBeenPwned k-anonymity, an owner toggle) does it server-side
 * at signup/update, and a client-side duplicate would leak the password prefix
 * from the browser for no additional safety.
 */

export type PasswordRule = {
  key: string;
  bn: string;
  en: string;
  test: (pw: string) => boolean;
};

export const PASSWORD_RULES: PasswordRule[] = [
  { key: "length", bn: "কমপক্ষে ৮ অক্ষর", en: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { key: "case", bn: "বড় ও ছোট হাতের অক্ষর", en: "Upper and lower case", test: (pw) => /[A-Z]/.test(pw) && /[a-z]/.test(pw) },
  { key: "digit", bn: "অন্তত একটি সংখ্যা", en: "At least one number", test: (pw) => /\d/.test(pw) },
  { key: "symbol", bn: "অন্তত একটি বিশেষ চিহ্ন", en: "At least one symbol", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

/** Rules a password satisfies. The checklist renders this; the button gates on it. */
export function passedRules(pw: string): Set<string> {
  return new Set(PASSWORD_RULES.filter((r) => r.test(pw)).map((r) => r.key));
}

/**
 * Acceptance. Length is mandatory; three of the four rules overall.
 *
 * Not all four: a hard symbol requirement is the single most reliable way to
 * push a school office onto `Password1!` written on a sticky note. Length plus
 * variety is what actually correlates with resistance.
 */
export function isAcceptable(pw: string): boolean {
  const passed = passedRules(pw);
  return passed.has("length") && passed.size >= 3;
}

export type Strength = 0 | 1 | 2 | 3 | 4;

/**
 * 0–4 score. Rules met, minus a penalty for the patterns that make a password
 * that *satisfies the rules* still trivial — a keyboard run, a repeated
 * character, or the product's own name.
 */
export function scorePassword(pw: string): Strength {
  if (!pw) return 0;
  let score = passedRules(pw).size;
  if (pw.length >= 14) score = Math.min(4, score + 1);

  const lower = pw.toLowerCase();
  const weak =
    /(.)\1{2,}/.test(pw) ||
    /0123|1234|2345|3456|4567|5678|6789/.test(pw) ||
    /abcd|qwer|asdf|zxcv/.test(lower) ||
    /password|edufusion|admin|school|123456/.test(lower);
  if (weak) score = Math.min(score, 1);

  return Math.max(0, Math.min(4, score)) as Strength;
}

export const STRENGTH_LABELS: { bn: string; en: string }[] = [
  { bn: "খুব দুর্বল", en: "Very weak" },
  { bn: "দুর্বল", en: "Weak" },
  { bn: "মোটামুটি", en: "Fair" },
  { bn: "ভালো", en: "Good" },
  { bn: "শক্তিশালী", en: "Strong" },
];
