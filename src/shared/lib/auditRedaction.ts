/**
 * Personal data in an audit payload, and what to show instead (audit M-14,
 * S-11.4).
 *
 * `before`/`after` on a `student` row is the whole record — phone, guardian
 * name, national ID, date of birth, address — printed verbatim to anyone
 * holding `audit.read`. The audit log's purpose is accountability for changes,
 * and reading a child's address is not that.
 *
 * THIS IS A DISPLAY CONTROL, NOT AN ACCESS CONTROL, and the distinction is not
 * a quibble. The rows still arrive at the browser intact — the screen reads
 * `audit_log` through PostgREST, and RLS admits the whole row. Anyone with the
 * anon key, a session and curl reads what this hides. Making it enforceable
 * means moving the list read behind an RPC that strips the keys in Postgres,
 * which changes the screen's whole data path and belongs with the Phase 4
 * data-contract retrofit.
 *
 * What it does buy, today: an operator glancing at the log over someone's
 * shoulder does not see a phone number, revealing is a deliberate act, and
 * `fn_log_audit_reveal` writes that act to `access_log` and to the audit log
 * itself. "Nobody could tell who had read it" is the half of the finding that
 * closes here.
 */

/**
 * Matched against the key, case-insensitively, as a substring — so `phone`
 * catches `guardian_phone` and `father_phone` without listing every column of
 * every audited table. Deliberately a little over-eager: a redacted field the
 * operator did not need costs one click, and a leaked one costs a disclosure.
 */
const PII_KEY_PATTERNS = [
  "phone",
  "mobile",
  "nid",
  "national_id",
  "birth_reg",
  "dob",
  "date_of_birth",
  "address",
  "email",
  "guardian_name",
  "father_name",
  "mother_name",
  "account_number",
] as const;

export function isPiiKey(key: string): boolean {
  const k = key.toLowerCase();
  return PII_KEY_PATTERNS.some((p) => k.includes(p));
}

/** The placeholder. Not the value's length or shape — that leaks too. */
export const REDACTED = "•••••";

/** Every PII key present in either side of a change set, for the reveal prompt's count. */
export function countRedactable(keys: readonly string[]): number {
  return keys.filter(isPiiKey).length;
}
