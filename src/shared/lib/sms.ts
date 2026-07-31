/**
 * SMS encoding detection and segment counting — the arithmetic that decides
 * what a campaign costs.
 *
 * WHY (SRA F-2b). The Send screen counted segments as `ceil(chars / 160)`
 * regardless of language. 160 is the GSM-7 figure. **Bangla is not GSM-7.** Any
 * character outside the GSM 03.38 alphabet forces the whole message to UCS-2,
 * where a segment holds **70** characters (67 when concatenated, because the
 * UDH concatenation header eats 6 of the 140 payload bytes).
 *
 * In a Bangla-first product that is not an edge case, it is the default case: an
 * ordinary 150-character Bangla notice displayed as 1 segment and actually cost
 * 3. Every Bangla campaign was under-counted by roughly 2.3x, and the operator
 * was quoted the wrong price before pressing Send.
 *
 * These functions are pure and unit-tested because they are money.
 */

/**
 * The GSM 03.38 basic alphabet plus its extension table.
 *
 * Written as an explicit character set rather than a range test because the
 * alphabet is *not* a contiguous block — it includes `£ ¥ è é § Ø Æ` and the
 * Greek capitals, and excludes plenty of Latin-1 that looks safe. Getting this
 * wrong in the permissive direction under-bills; a literal table cannot drift.
 */
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

/** Escape-table characters: legal in GSM-7 but each costs TWO septets. */
const GSM7_EXTENDED = "^{}\\[~]|€";

const GSM7_SET = new Set([...GSM7_BASIC, ...GSM7_EXTENDED]);
const GSM7_EXT_SET = new Set([...GSM7_EXTENDED]);

export type SmsEncoding = "GSM-7" | "UCS-2";

export type SmsCost = {
  encoding: SmsEncoding;
  /** Billable units: septets for GSM-7, UTF-16 code units for UCS-2. */
  units: number;
  /** Plain character count, for the "N characters" readout. */
  chars: number;
  segments: number;
  /** Capacity of the segments actually used — 160/153 or 70/67. */
  perSegment: number;
};

/**
 * Segment capacities. The second number applies once a message needs more than
 * one segment, because concatenation adds a 6-byte User Data Header to *every*
 * part — so a 161-character GSM-7 message is 2x153, not 160+1.
 */
const LIMITS = {
  "GSM-7": { single: 160, multi: 153 },
  "UCS-2": { single: 70, multi: 67 },
} as const;

/** UCS-2 the moment a single character falls outside GSM-7 — as the radio does. */
export function smsEncoding(body: string): SmsEncoding {
  for (const ch of body) if (!GSM7_SET.has(ch)) return "UCS-2";
  return "GSM-7";
}

/**
 * Billable units.
 *
 * GSM-7: one septet per character, two for an extension-table character.
 * UCS-2: one unit per UTF-16 code unit — so an emoji or any astral-plane
 * character is 2, which is why this counts `.length` and not `[...body].length`.
 */
function unitsFor(body: string, encoding: SmsEncoding): number {
  if (encoding === "UCS-2") return body.length;
  let units = 0;
  for (const ch of body) units += GSM7_EXT_SET.has(ch) ? 2 : 1;
  return units;
}

/**
 * Everything the Send screen needs to quote a price honestly.
 *
 * An empty body is 0 segments, not 1: quoting a cost for a message that cannot
 * be sent is the same class of lie this module exists to remove.
 */
export function smsCost(body: string): SmsCost {
  const encoding = smsEncoding(body);
  const units = unitsFor(body, encoding);
  const chars = [...body].length;
  const limit = LIMITS[encoding];

  if (units === 0) return { encoding, units, chars, segments: 0, perSegment: limit.single };
  if (units <= limit.single)
    return { encoding, units, chars, segments: 1, perSegment: limit.single };

  return {
    encoding,
    units,
    chars,
    segments: Math.ceil(units / limit.multi),
    perSegment: limit.multi,
  };
}

/**
 * Total messages billed for a campaign: segments x recipients.
 *
 * Gateways bill per segment per recipient. Debiting the balance by recipient
 * count alone — which is what the product did — under-charges every multi-part
 * message and leaves the institution's balance and the gateway's invoice
 * permanently disagreeing.
 */
export function campaignUnits(body: string, recipients: number): number {
  return smsCost(body).segments * Math.max(0, recipients);
}
