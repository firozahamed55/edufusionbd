/**
 * Bilingual enumerations mirrored from EduFusionBD_Admin_DataModel.md §11.
 * Store the `value` in the DB; render bn/en per active locale.
 */
export type BiLabel = { value: string; bn: string; en: string };

export const GENDER: BiLabel[] = [
  { value: "male", bn: "পুরুষ", en: "Male" },
  { value: "female", bn: "মহিলা", en: "Female" },
  { value: "other", bn: "অন্যান্য", en: "Other" },
];

export const BLOOD_GROUP = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const RELIGION: BiLabel[] = [
  { value: "islam", bn: "ইসলাম", en: "Islam" },
  { value: "hindu", bn: "হিন্দু", en: "Hindu" },
  { value: "christian", bn: "খ্রিষ্টান", en: "Christian" },
  { value: "buddhist", bn: "বৌদ্ধ", en: "Buddhist" },
  { value: "other", bn: "অন্যান্য", en: "Other" },
];

export const STUDENT_STATUS: BiLabel[] = [
  { value: "active", bn: "সক্রিয়", en: "Active" },
  { value: "inactive", bn: "নিষ্ক্রিয়", en: "Inactive" },
  { value: "transferred", bn: "স্থানান্তরিত", en: "Transferred" },
];

export const ATTENDANCE_STATUS: BiLabel[] = [
  { value: "present", bn: "উপস্থিত", en: "Present" },
  { value: "absent", bn: "অনুপস্থিত", en: "Absent" },
  { value: "late", bn: "দেরি", en: "Late" },
  { value: "leave", bn: "ছুটি", en: "Leave" },
];

export const FEE_STATUS: BiLabel[] = [
  { value: "paid", bn: "পরিশোধিত", en: "Paid" },
  { value: "due", bn: "বকেয়া", en: "Due" },
  { value: "partial", bn: "আংশিক", en: "Partial" },
];

/** Kept in step with `paymentMethod` in shared/lib/validation.ts by a test in
 *  shared/lib/validation.test.ts — add a method in both places or it fails. */
export const PAYMENT_METHOD: BiLabel[] = [
  { value: "cash", bn: "নগদ", en: "Cash" },
  { value: "bkash", bn: "বিকাশ", en: "bKash" },
  { value: "nagad", bn: "নগদ", en: "Nagad" },
  { value: "rocket", bn: "রকেট", en: "Rocket" },
  { value: "card", bn: "কার্ড", en: "Card" },
];

export const LANGUAGE: BiLabel[] = [
  { value: "bn", bn: "বাংলা", en: "Bangla" },
  { value: "en", bn: "ইংরেজি", en: "English" },
];

export const EMPLOYMENT_TYPE: BiLabel[] = [
  { value: "permanent", bn: "স্থায়ী", en: "Permanent" },
  { value: "part_time", bn: "খণ্ডকালীন", en: "Part-time" },
];

/**
 * Single source of truth for blood-group ↔ DB enum mapping.
 * UI shows the human label ("A+"); the DB stores the `blood_group` enum token
 * ("a_pos"). Store `.value` label in form state, map to token on write.
 */
export const BLOOD_TOKEN: Record<string, string> = {
  "A+": "a_pos",
  "A-": "a_neg",
  "B+": "b_pos",
  "B-": "b_neg",
  "AB+": "ab_pos",
  "AB-": "ab_neg",
  "O+": "o_pos",
  "O-": "o_neg",
};

/** Inverse of {@link BLOOD_TOKEN}: DB token → UI label (for edit-mode hydration). */
export const BLOOD_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(BLOOD_TOKEN).map(([label, token]) => [token, label]),
);
