/**
 * Single source of truth for Quest's mastery + spaced-repetition logic.
 *
 * Every learning surface (curriculum learn/review sessions, assigned learning
 * sessions, and self-made sessions) routes its grading and review scheduling
 * through here so the pass bar, interval ladder, and pass/borderline/fail
 * behavior are identical everywhere.
 */

// Score (0–100) required to "pass" a session / count a topic as mastered.
export const PASS_THRESHOLD = 80;

/**
 * Clamp any raw number to a valid session score: a 0–100 integer.
 * Use everywhere a score is computed or read back so nothing can ever display
 * or store above 100% (or below 0).
 */
export function clampScore(n) {
  if (n == null || Number.isNaN(Number(n))) return 0;
  return Math.max(0, Math.min(100, Math.round(Number(n))));
}

/**
 * The platform-standard session score (0–100). ONLY the quiz and the case study
 * count toward a session score — attention checks NEVER contribute.
 *
 * Combination is points-based: total points earned / total points possible
 * across whichever of (quiz, case study) the session actually included. Each
 * quiz question is worth 1 point; the case study is worth its own max. Each
 * component is clamped to its own max first, so the result can never exceed 100.
 *
 * @param {object} p
 * @param {number} [p.quizCorrect] correct quiz answers
 * @param {number} [p.quizTotal]   number of quiz questions
 * @param {number} [p.caseScore]   case-study points earned
 * @param {number} [p.caseMax]     case-study points possible
 * @returns {number|null} 0–100, or null when the session had neither component
 */
export function computeSessionScore({
  quizCorrect = 0,
  quizTotal = 0,
  caseScore = null,
  caseMax = null,
} = {}) {
  let earned = 0;
  let possible = 0;
  if (quizTotal > 0) {
    earned += Math.max(0, Math.min(Number(quizCorrect) || 0, quizTotal));
    possible += quizTotal;
  }
  if (caseMax != null && caseMax > 0) {
    earned += Math.max(0, Math.min(Number(caseScore) || 0, caseMax));
    possible += caseMax;
  }
  if (possible === 0) return null;
  return clampScore((earned / possible) * 100);
}

// Below this, a review failed hard — the topic isn't retained, so we reset it
// and send the student back to relearn (a new learn session that same day).
// Between this and PASS_THRESHOLD is the "borderline" band: repeat the same
// review without advancing. So: >=80 completed, 60-79 repeat, <60 restart.
export const RELEARN_THRESHOLD = 60;

// Days between successive reviews. After the last entry, the final interval
// repeats indefinitely.
export const REVIEW_INTERVALS = [1, 3, 7, 14, 21, 30];

// Cumulative offsets (days from the first session) for flows that pre-queue a
// fixed review schedule rather than scheduling one review at a time.
export const REVIEW_OFFSETS = REVIEW_INTERVALS.reduce((acc, d) => {
  acc.push((acc[acc.length - 1] || 0) + d);
  return acc;
}, []); // [1, 4, 11, 25, 46, 76]

// Days until the next review given how many reviews have already been passed.
export function reviewIntervalDays(reviewCount) {
  return reviewCount < REVIEW_INTERVALS.length
    ? REVIEW_INTERVALS[reviewCount]
    : REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1];
}

export function addDays(days, from = new Date()) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Grade a first-time (learn) session.
 * @returns { passed, reviewCount, nextReviewDate|null, urgency }
 */
export function gradeLearnSession(score) {
  const passed = score >= PASS_THRESHOLD;
  return {
    passed,
    reviewCount: 0,
    nextReviewDate: passed ? addDays(reviewIntervalDays(0)) : null,
    urgency: passed ? "Low" : "Medium",
  };
}

/**
 * Grade a review attempt.
 * @param {number} score 0–100
 * @param {number} currentReviewCount reviews already passed
 * @returns { outcome: 'pass'|'borderline'|'fail', learned, mustRelearn,
 *            reviewCount, nextReviewDate, urgency }
 */
export function gradeReview(score, currentReviewCount = 0) {
  if (score >= PASS_THRESHOLD) {
    const reviewCount = currentReviewCount + 1;
    return {
      outcome: "pass",
      learned: true,
      mustRelearn: false,
      reviewCount,
      nextReviewDate: addDays(reviewIntervalDays(reviewCount)),
      urgency: "Low",
    };
  }
  if (score >= RELEARN_THRESHOLD) {
    // Borderline — retry this same review tomorrow, don't advance the ladder.
    return {
      outcome: "borderline",
      learned: false,
      mustRelearn: false,
      reviewCount: currentReviewCount,
      nextReviewDate: addDays(1),
      urgency: "Critical",
    };
  }
  // Failed — not retained. Reset to relearn from scratch.
  return {
    outcome: "fail",
    learned: false,
    mustRelearn: true,
    reviewCount: 0,
    nextReviewDate: new Date(),
    urgency: "Critical",
  };
}
