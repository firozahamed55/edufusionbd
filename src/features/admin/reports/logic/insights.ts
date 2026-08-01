/**
 * The interpretation layer (analysis II · R-3).
 *
 * THE DISTINCTION THIS MODULE EXISTS TO MAKE. A *statistic* states what is. An
 * *insight* states what is unexpected, and what to do about it. The test the
 * requirements doc sets is "could a reader act differently because of this
 * line?" — and "Class Six: 41 students" fails it while "Class Six is 41
 * students, 12 above the 29-student average and the only unsplit class" passes.
 *
 * DETERMINISTIC, NOT GENERATED. Every finding here is a rule with a stated
 * threshold, computed from the report's own numbers. Nothing is inferred by a
 * model. Two reasons, and the second is the load-bearing one:
 *
 *  1. A finding a head teacher will act on — phone a guardian, call a parent
 *     meeting, move a child to a remedial class — has to be reproducible. If
 *     the same data can produce a different sentence tomorrow, the sentence is
 *     not evidence.
 *  2. Every threshold is rendered ON SCREEN beside its finding. A reader who
 *     disagrees with "below 75%" can see that 75% is the rule and discount it.
 *     A reader shown model prose has nothing to disagree with.
 *
 * Findings carry a `tone` rather than a severity number: they are read, not
 * sorted into a queue. `positive` exists because a report that only ever says
 * what is wrong gets read as noise within a term.
 */

export type FindingTone = "critical" | "warning" | "neutral" | "positive";

export type Finding = {
  /** Stable across renders and locales — used as a React key and in exports. */
  key: string;
  tone: FindingTone;
  /** The finding itself, already interpolated. Bengali and English. */
  bn: string;
  en: string;
  /**
   * The rule that produced it, in the reader's hands. "12+ above the mean",
   * "below 75%". Rendered in a quieter style next to the finding.
   */
  ruleBn: string;
  ruleEn: string;
  /** Optional deep link to the list that acts on the finding. */
  href?: string;
};

/* ------------------------------------------------------------ primitives */

/** Arithmetic mean; `null` for an empty set rather than `NaN` or 0. */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Sample standard deviation. `null` below two points — one observation has no
 * spread, and reporting 0 would make every single-section school an outlier
 * detector that fires on everything.
 */
export function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values) as number;
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * How much of a total the largest `n` contributors account for.
 *
 * The concentration finding — "61% of the arrears sit with 14 students" — is
 * the one that most often changes what an administrator does, because it turns
 * an institution-wide problem into a phone list.
 */
export function concentration(
  values: number[],
  topN: number,
): { share: number; count: number; total: number } | null {
  const positive = values.filter((v) => v > 0).sort((a, b) => b - a);
  if (positive.length === 0) return null;
  const total = positive.reduce((s, v) => s + v, 0);
  if (total <= 0) return null;
  const count = Math.min(topN, positive.length);
  const head = positive.slice(0, count).reduce((s, v) => s + v, 0);
  return { share: head / total, count, total };
}

/* -------------------------------------------------------------- thresholds */

/**
 * Every threshold in one place, so the numbers a report asserts can be read
 * off a single screen of code rather than reconstructed from the rules.
 *
 * `ATTENDANCE_FLOOR` is 75 because that is the figure that gates exam
 * eligibility in this product — the report and the regulation agree by
 * construction rather than by coincidence.
 */
export const THRESHOLDS = {
  /** Class size this far above the mean is called out. */
  CLASS_SIZE_SIGMA: 1.5,
  /** …but never for a difference smaller than this, however small the spread. */
  CLASS_SIZE_MIN_DELTA: 5,
  ATTENDANCE_FLOOR: 75,
  /** A subject whose fail rate exceeds the all-subject rate by this many points. */
  SUBJECT_DIFFICULTY_POINTS: 15,
  /** Concentration is only worth saying when the head is this dominant. */
  CONCENTRATION_SHARE: 0.5,
  CONCENTRATION_TOP_N: 10,
  /** Data-completeness gap worth reporting, as a share of the population. */
  COMPLETENESS_GAP: 0.1,
} as const;

/* ------------------------------------------------------------- enrolment */

export type ClassSize = {
  name_bn: string;
  name_en: string;
  total: number;
  sections: number;
};

/**
 * Findings over the enrolment report.
 *
 * The outlier rule is two-part: more than `CLASS_SIZE_SIGMA` standard
 * deviations clear of the other classes AND at least `CLASS_SIZE_MIN_DELTA`
 * students clear of them.
 *
 * Both halves earn their place, in opposite directions:
 *
 *  - Sigma alone is unusable at this scale. A school whose classes are 28, 29
 *    and 30 has a standard deviation of 1, so every class is an "outlier" at
 *    1.5σ and none of them is worth a sentence.
 *  - A flat "N above average" alone would fire on a school whose class sizes
 *    genuinely vary that much by design.
 *
 * LEAVE-ONE-OUT, like the subject-difficulty rule below. Compared against a
 * mean and sigma it is itself inside, a single extreme class inflates the very
 * spread used to judge it and hides — this is not theoretical: classes of 25,
 * 26 and 41 produce σ = 9, so the 41 sits only 1.15σ out and the rule that
 * exists to catch it says nothing.
 */
export function enrolmentFindings(input: {
  classes: ClassSize[];
  total: number;
  boys: number;
  girls: number;
  dobMissing: number;
  religionMissing: number;
}): Finding[] {
  const out: Finding[] = [];

  for (const c of input.classes) {
    const others = input.classes.filter((o) => o !== c).map((o) => o.total);
    const m = mean(others);
    const sd = stdDev(others);
    // Fewer than three classes in total leaves no "typical" to be atypical of.
    if (m === null || sd === null || sd <= 0) continue;
    const delta = c.total - m;
    if (delta < THRESHOLDS.CLASS_SIZE_SIGMA * sd || delta < THRESHOLDS.CLASS_SIZE_MIN_DELTA) continue;
    const over = Math.round(delta);
    const unsplit = c.sections === 1;
    out.push({
      key: `class-large-${c.name_en}`,
      tone: "warning",
      bn: `${c.name_bn} শ্রেণিতে ${c.total} জন — বাকি শ্রেণির গড় ${Math.round(m)} জনের চেয়ে ${over} জন বেশি${unsplit ? ", এবং এটি একটিমাত্র শাখা" : ""}।`,
      en: `${c.name_en} has ${c.total} students, ${over} above the ${Math.round(m)}-student average of the other classes${unsplit ? " — and it is a single unsplit section" : ""}.`,
      ruleBn: `বাকি শ্রেণিগুলোর তুলনায় ${THRESHOLDS.CLASS_SIZE_SIGMA}σ ও ${THRESHOLDS.CLASS_SIZE_MIN_DELTA}+ জন দূরে`,
      ruleEn: `${THRESHOLDS.CLASS_SIZE_SIGMA}σ and ${THRESHOLDS.CLASS_SIZE_MIN_DELTA}+ students clear of every other class`,
    });
  }

  /**
   * Gender skew. Reported as a fact, not as a problem — a girls' school is not
   * an anomaly — which is why the tone is neutral and the sentence does not
   * suggest an action.
   */
  if (input.total > 0) {
    const girlShare = input.girls / input.total;
    if (girlShare >= 0.65 || girlShare <= 0.35) {
      const pct = Math.round(girlShare * 100);
      out.push({
        key: "gender-skew",
        tone: "neutral",
        bn: `শিক্ষার্থীদের ${pct}% মেয়ে।`,
        en: `${pct}% of the roll is girls.`,
        ruleBn: "৩৫%–৬৫% এর বাইরে",
        ruleEn: "outside a 35–65% split",
      });
    }
  }

  /**
   * Completeness. This is the finding with an operational consequence the
   * report itself cannot show: every SMS the school sends depends on a
   * contactable guardian, and every age figure on the screen above depends on
   * a date of birth.
   */
  if (input.total > 0 && input.dobMissing / input.total >= THRESHOLDS.COMPLETENESS_GAP) {
    const pct = Math.round((input.dobMissing / input.total) * 100);
    out.push({
      key: "dob-gap",
      tone: "critical",
      bn: `${input.dobMissing} জনের (${pct}%) জন্মতারিখ নেই — এই রিপোর্টের বয়স-বিভাজন তাদের বাদ দিয়ে গণনা করা।`,
      en: `${input.dobMissing} students (${pct}%) have no date of birth — the age breakdown above is computed without them.`,
      ruleBn: `${Math.round(THRESHOLDS.COMPLETENESS_GAP * 100)}%+ অনুপস্থিত`,
      ruleEn: `${Math.round(THRESHOLDS.COMPLETENESS_GAP * 100)}%+ missing`,
      href: "/admin/student/update-basic",
    });
  }
  if (input.total > 0 && input.religionMissing / input.total >= THRESHOLDS.COMPLETENESS_GAP) {
    const pct = Math.round((input.religionMissing / input.total) * 100);
    out.push({
      key: "religion-gap",
      tone: "warning",
      bn: `${input.religionMissing} জনের (${pct}%) ধর্ম রেকর্ড করা হয়নি।`,
      en: `Religion is not recorded for ${input.religionMissing} students (${pct}%).`,
      ruleBn: `${Math.round(THRESHOLDS.COMPLETENESS_GAP * 100)}%+ অনুপস্থিত`,
      ruleEn: `${Math.round(THRESHOLDS.COMPLETENESS_GAP * 100)}%+ missing`,
      href: "/admin/student/update-basic",
    });
  }

  return out;
}

/* -------------------------------------------------------------- academic */

export type SubjectPerformance = {
  name: string;
  appeared: number;
  failed: number;
  averagePct: number;
};

/**
 * Findings over the academic report.
 *
 * The subject-difficulty rule is the one the requirements doc names by
 * example: "31% scored below the pass mark in Mathematics against 9% across
 * all other subjects". Note the comparison is against the OTHER subjects, not
 * against the overall rate — a subject is part of its own overall figure, so
 * comparing to it understates a genuine outlier and, in a two-subject exam,
 * conceals it almost entirely.
 */
export function academicFindings(input: {
  subjects: SubjectPerformance[];
  passRate: number | null;
  appeared: number;
}): Finding[] {
  const out: Finding[] = [];

  for (const s of input.subjects) {
    if (s.appeared === 0) continue;
    const others = input.subjects.filter((o) => o.name !== s.name);
    const otherAppeared = others.reduce((sum, o) => sum + o.appeared, 0);
    if (otherAppeared === 0) continue;
    const otherFailPct = (others.reduce((sum, o) => sum + o.failed, 0) / otherAppeared) * 100;
    const failPct = (s.failed / s.appeared) * 100;
    if (failPct - otherFailPct >= THRESHOLDS.SUBJECT_DIFFICULTY_POINTS) {
      out.push({
        key: `subject-hard-${s.name}`,
        tone: "critical",
        bn: `${s.name} বিষয়ে ${Math.round(failPct)}% পাশ নম্বরের নিচে, অন্য সব বিষয়ে ${Math.round(otherFailPct)}% — এই পরীক্ষায় ${s.name} ব্যতিক্রম।`,
        en: `${Math.round(failPct)}% scored below the pass mark in ${s.name}, against ${Math.round(otherFailPct)}% across all other subjects — ${s.name} is the outlier this exam.`,
        ruleBn: `অন্য বিষয়ের তুলনায় ${THRESHOLDS.SUBJECT_DIFFICULTY_POINTS}+ পয়েন্ট বেশি ফেল`,
        ruleEn: `${THRESHOLDS.SUBJECT_DIFFICULTY_POINTS}+ points above the fail rate of every other subject`,
      });
    }
  }

  if (input.passRate !== null && input.appeared > 0) {
    if (input.passRate >= 95) {
      out.push({
        key: "pass-rate-high",
        tone: "positive",
        bn: `${Math.round(input.passRate)}% শিক্ষার্থী উত্তীর্ণ।`,
        en: `${Math.round(input.passRate)}% of those who sat the exam passed.`,
        ruleBn: "৯৫%+ উত্তীর্ণ",
        ruleEn: "95%+ pass rate",
      });
    } else if (input.passRate < 70) {
      out.push({
        key: "pass-rate-low",
        tone: "critical",
        bn: `${Math.round(input.passRate)}% উত্তীর্ণ — ${input.appeared - Math.round((input.passRate / 100) * input.appeared)} জন অনুত্তীর্ণ।`,
        en: `${Math.round(input.passRate)}% passed — ${input.appeared - Math.round((input.passRate / 100) * input.appeared)} students did not.`,
        ruleBn: "৭০% এর নিচে উত্তীর্ণ",
        ruleEn: "below a 70% pass rate",
      });
    }
  }

  return out;
}

/* --------------------------------------------------------------- at-risk */

/**
 * Findings over the at-risk register. The concentration rule is the whole
 * point of the report: a ranked list is only actionable if it is short, and
 * saying how short is what turns it into this afternoon's phone calls.
 */
export function atRiskFindings(input: {
  totalStudents: number;
  atRisk: number;
  multiSignal: number;
  arrears: number[];
  /**
   * Whether all three signals could actually be computed.
   *
   * The clean-bill-of-health finding is suppressed when any of them could not.
   * "No student crosses a threshold" is a claim about the students; with a
   * signal switched off for want of data it is a claim about the data wearing
   * the students' clothes, and it is the single most reassuring sentence on
   * the page.
   */
  allSignalsAvailable: boolean;
}): Finding[] {
  const out: Finding[] = [];

  if (input.multiSignal > 0) {
    out.push({
      key: "multi-signal",
      tone: "critical",
      bn: `${input.multiSignal} জন শিক্ষার্থীর ক্ষেত্রে একাধিক ঝুঁকির লক্ষণ একসঙ্গে দেখা যাচ্ছে।`,
      en: `${input.multiSignal} students show more than one risk signal at once.`,
      ruleBn: "২+ সংকেত",
      ruleEn: "2 or more signals",
    });
  }

  const conc = concentration(input.arrears, THRESHOLDS.CONCENTRATION_TOP_N);
  if (conc && conc.share >= THRESHOLDS.CONCENTRATION_SHARE) {
    const pct = Math.round(conc.share * 100);
    out.push({
      key: "arrears-concentration",
      tone: "warning",
      bn: `বকেয়ার ${pct}% মাত্র ${conc.count} জন শিক্ষার্থীর কাছে।`,
      en: `${pct}% of the outstanding balance sits with just ${conc.count} students.`,
      ruleBn: `শীর্ষ ${THRESHOLDS.CONCENTRATION_TOP_N} জনের হাতে ${Math.round(THRESHOLDS.CONCENTRATION_SHARE * 100)}%+`,
      ruleEn: `top ${THRESHOLDS.CONCENTRATION_TOP_N} hold ${Math.round(THRESHOLDS.CONCENTRATION_SHARE * 100)}%+`,
    });
  }

  if (input.totalStudents > 0 && input.atRisk === 0 && input.allSignalsAvailable) {
    out.push({
      key: "none-at-risk",
      tone: "positive",
      bn: "কোনো শিক্ষার্থী ঝুঁকির সীমা অতিক্রম করেনি।",
      en: "No student currently crosses any of the three risk thresholds.",
      ruleBn: "উপস্থিতি ৭৫%, বকেয়া ৯০ দিন, ফলাফল অবনতি",
      ruleEn: "75% attendance · 90-day arrears · falling marks",
    });
  }

  return out;
}
