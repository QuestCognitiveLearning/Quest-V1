/**
 * Deterministic answer-choice shuffling for multiple-choice items
 * (quiz questions AND attention checks), so the correct answer doesn't
 * always land on the same letter.
 *
 * Why this matters: the AI generator tends to emit the correct answer in a
 * fixed slot (often "A" / choice_1). Several render paths showed the choices
 * in stored order, so the correct answer was almost always the same letter —
 * an obvious tell for students. This permutes the choices and remaps the
 * `correct_choice` pointer so display AND grading stay consistent (every
 * consumer reads the same `choice_*` + `correct_choice` fields).
 *
 * The shuffle is SEEDED by the question's own text + choices, so:
 *   - it is stable across React re-renders (no options jumping around), and
 *   - different questions get different permutations (correct answer spreads
 *     across A/B/C/D over a quiz), with no global Math.random() needed.
 *
 * Supported shapes (auto-detected per item):
 *   - letter keys:  { choice_a, choice_b, choice_c, choice_d, correct_choice: "A".."D" }
 *   - numeric keys: { choice_1, choice_2, choice_3, choice_4, correct_choice: 1..4 }
 * `correct_choice` may be a number (1-4) or a letter (any case). Items with
 * fewer than 4 populated choices keep their populated choices contiguous.
 */

const LETTERS = ["A", "B", "C", "D"];
const LETTER_KEYS = ["choice_a", "choice_b", "choice_c", "choice_d"];
const NUMBER_KEYS = ["choice_1", "choice_2", "choice_3", "choice_4"];

// FNV-1a string hash → 32-bit unsigned. Stable and dependency-free.
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 — tiny seeded PRNG. Avoids Math.random() so order is deterministic.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seeded Fisher-Yates over [0..n-1].
function seededPermutation(n, seed) {
  const rand = mulberry32(seed);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

/**
 * Returns a NEW question object with its answer choices shuffled and
 * `correct_choice` remapped. Non-MCQ or malformed items are returned unchanged.
 */
export function shuffleQuestionChoices(q) {
  if (!q || typeof q !== "object") return q;

  const isNumeric = NUMBER_KEYS.some((k) => q[k] != null && q[k] !== "");
  const isLetter = LETTER_KEYS.some((k) => q[k] != null && q[k] !== "");
  if (!isNumeric && !isLetter) return q; // not a choice-bearing item
  const keys = isNumeric ? NUMBER_KEYS : LETTER_KEYS;

  // Indices (into `keys`) of populated choices, kept in original order.
  const present = keys
    .map((k, i) => (q[k] != null && q[k] !== "" ? i : -1))
    .filter((i) => i !== -1);
  if (present.length < 2) return q; // nothing meaningful to shuffle

  // Current correct slot, 0-based into `keys`.
  let correctSlot;
  if (typeof q.correct_choice === "number") {
    correctSlot = q.correct_choice - 1;
  } else {
    correctSlot = LETTERS.indexOf(String(q.correct_choice || "A").toUpperCase());
  }
  if (correctSlot < 0) correctSlot = present[0];

  const presentPos = present.indexOf(correctSlot);
  if (presentPos === -1) return q; // correct answer isn't a populated choice — leave as-is

  const seed = hashString(
    String(q.question_text || q.question || "") +
      "|" +
      present.map((i) => String(q[keys[i]])).join("|")
  );
  const perm = seededPermutation(present.length, seed); // perm[newPos] = oldPresentIndex

  const out = { ...q };
  const shuffledValues = perm.map((oldPresentIdx) => q[keys[present[oldPresentIdx]]]);
  // Write shuffled values back into the populated slots (front-loaded);
  // any trailing empty slots keep their original empty value.
  present.forEach((slot, newPos) => {
    out[keys[slot]] = shuffledValues[newPos];
  });

  const newCorrectPos = perm.indexOf(presentPos); // position within `present`
  const newCorrectSlot = present[newCorrectPos];
  out.correct_choice = isNumeric ? newCorrectSlot + 1 : LETTERS[newCorrectSlot];

  return out;
}

/** Map a list of questions/checks through {@link shuffleQuestionChoices}. */
export function shuffleQuestionList(list) {
  return Array.isArray(list) ? list.map(shuffleQuestionChoices) : list;
}
