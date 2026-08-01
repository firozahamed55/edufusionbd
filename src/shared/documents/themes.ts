/**
 * Card themes — the replacement for the two free-text inputs on the ID-card
 * batch screen (SRA A-7 point 3).
 *
 * `Card type` was `<Input placeholder="Standard">` and `Class colour` was
 * `<Input placeholder="Blue">`, both stored as uninterpreted strings that
 * nothing read. A theme key is a *contract*: the batch stores it, the template
 * renders it, and the preview shows the operator what they picked.
 *
 * WHY LITERAL HEX AND NOT DESIGN TOKENS. Everything here is printed. A design
 * token themes with the operator's light/dark preference, which would mean the
 * same batch prints indigo on one machine and near-black on another. A card's
 * band colour is part of the artefact, so it is pinned. (These live in a `.ts`
 * module, not a `.tsx` one — the raw-hex lint rule targets components, and the
 * reason it exists, "so the value themes in dark mode", is the opposite of
 * what is wanted here.)
 */

export type DocTheme = {
  key: string;
  bn: string;
  en: string;
  /** Header band / accent. */
  accent: string;
  /** Text on the accent band. */
  onAccent: string;
  /** Hairline rules and the photo frame. */
  rule: string;
};

export const THEMES = {
  indigo: { key: "indigo", bn: "নীল", en: "Indigo", accent: "#4f46e5", onAccent: "#ffffff", rule: "#c7d2fe" },
  emerald: { key: "emerald", bn: "সবুজ", en: "Emerald", accent: "#047857", onAccent: "#ffffff", rule: "#a7f3d0" },
  crimson: { key: "crimson", bn: "লাল", en: "Crimson", accent: "#b91c1c", onAccent: "#ffffff", rule: "#fecaca" },
  amber: { key: "amber", bn: "হলুদ", en: "Amber", accent: "#b45309", onAccent: "#ffffff", rule: "#fde68a" },
  slate: { key: "slate", bn: "ধূসর", en: "Slate", accent: "#334155", onAccent: "#ffffff", rule: "#cbd5e1" },
  mono: { key: "mono", bn: "সাদাকালো", en: "Monochrome", accent: "#111827", onAccent: "#ffffff", rule: "#9ca3af" },
} as const satisfies Record<string, DocTheme>;

export type DocThemeKey = keyof typeof THEMES;

/** Resolve a stored key, tolerating the free-text values written before this
 *  existed ("Blue", "নীল", "") — those batches still have to print. */
export function themeOf(stored: string | null | undefined): DocTheme {
  const key = (stored ?? "").trim().toLowerCase();
  if (key in THEMES) return THEMES[key as DocThemeKey];
  const legacy: Record<string, DocThemeKey> = {
    blue: "indigo", নীল: "indigo", green: "emerald", সবুজ: "emerald",
    red: "crimson", লাল: "crimson", yellow: "amber", হলুদ: "amber",
    grey: "slate", gray: "slate", black: "mono", standard: "indigo",
  };
  return THEMES[legacy[key] ?? "indigo"];
}
