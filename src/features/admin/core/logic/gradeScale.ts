import type { GradeScale } from "./api";

/**
 * Grading-scheme validation (SRA A-9.1).
 *
 * WHY THIS IS A CORRECTNESS FIX AND NOT POLISH. This table is the input to
 * `fn_process_exam_result`, which turns marks into grades and GPAs for an entire
 * cohort in one set-based pass. Nothing validated it. A scheme with overlapping
 * bands (A+ 80–100 beside A 75–85), a hole (nothing covering 70–72), or one that
 * does not reach 100 produces grades that are silently wrong — wrong in a way
 * nobody notices until a parent compares two marksheets, and by then the results
 * are published.
 *
 * The checks are ordered by how badly they mislead, and each names the exact
 * bands at fault, because "invalid scheme" on a seven-row table is not a fix.
 */

export type ScaleProblem = { bn: string; en: string };

/** Bands sorted low→high, ignoring rows the operator has not filled in yet. */
function ordered(scales: GradeScale[]): GradeScale[] {
  return scales
    .filter((s) => s.grade_letter.trim() !== "")
    .slice()
    .sort((a, b) => a.min_marks - b.min_marks);
}

export function validateGradeScale(scales: GradeScale[]): ScaleProblem[] {
  const problems: ScaleProblem[] = [];
  const rows = ordered(scales);

  if (rows.length === 0) {
    return [{ bn: "অন্তত একটি গ্রেড সারি দিন।", en: "Add at least one grade row." }];
  }

  for (const s of rows) {
    if (s.min_marks > s.max_marks) {
      problems.push({
        bn: `${s.grade_letter}: সর্বনিম্ন (${s.min_marks}) সর্বোচ্চের (${s.max_marks}) চেয়ে বড়।`,
        en: `${s.grade_letter}: minimum (${s.min_marks}) is above maximum (${s.max_marks}).`,
      });
    }
    if (s.min_marks < 0 || s.max_marks > 100) {
      problems.push({
        bn: `${s.grade_letter}: পরিসর ০–১০০ এর বাইরে।`,
        en: `${s.grade_letter}: range falls outside 0–100.`,
      });
    }
  }

  const seen = new Set<string>();
  for (const s of rows) {
    const key = s.grade_letter.trim().toUpperCase();
    if (seen.has(key)) {
      problems.push({
        bn: `গ্রেড "${s.grade_letter}" একাধিকবার আছে।`,
        en: `Grade "${s.grade_letter}" appears more than once.`,
      });
    }
    seen.add(key);
  }

  // Overlaps and gaps, walking the sorted bands. Bands are inclusive on both
  // ends, so the next band must start at exactly previous.max + 1.
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const cur = rows[i];
    if (cur.min_marks <= prev.max_marks) {
      problems.push({
        bn: `${prev.grade_letter} (${prev.min_marks}–${prev.max_marks}) ও ${cur.grade_letter} (${cur.min_marks}–${cur.max_marks}) পরস্পরকে ওভারল্যাপ করছে।`,
        en: `${prev.grade_letter} (${prev.min_marks}–${prev.max_marks}) overlaps ${cur.grade_letter} (${cur.min_marks}–${cur.max_marks}).`,
      });
    } else if (cur.min_marks > prev.max_marks + 1) {
      problems.push({
        bn: `${prev.max_marks + 1}–${cur.min_marks - 1} নম্বরের জন্য কোনো গ্রেড নেই।`,
        en: `No grade covers marks ${prev.max_marks + 1}–${cur.min_marks - 1}.`,
      });
    }
  }

  const lowest = rows[0];
  const highest = rows[rows.length - 1];
  if (lowest.min_marks > 0) {
    problems.push({
      bn: `০–${lowest.min_marks - 1} নম্বরের জন্য কোনো গ্রেড নেই।`,
      en: `No grade covers marks 0–${lowest.min_marks - 1}.`,
    });
  }
  if (highest.max_marks < 100) {
    problems.push({
      bn: `${highest.max_marks + 1}–১০০ নম্বরের জন্য কোনো গ্রেড নেই।`,
      en: `No grade covers marks ${highest.max_marks + 1}–100.`,
    });
  }

  // A scheme where every band scores 0 GPA passes nobody and is almost
  // certainly half-edited.
  if (!rows.some((s) => s.gpa_point > 0)) {
    problems.push({
      bn: "কোনো গ্রেডেই জিপিএ ০ এর বেশি নয় — কেউ উত্তীর্ণ হতে পারবে না।",
      en: "No grade carries a GPA above 0 — nobody could pass.",
    });
  }

  return problems;
}
