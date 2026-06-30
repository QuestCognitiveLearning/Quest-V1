// Redistribute the correct-answer position across A–D so the same letter is
// never the correct answer more than twice in a row. LLMs tend to over-pick a
// single letter (often "A"/"C"), which makes the key look patterned; this
// reshuffles each item's choices while keeping the distractors' relative order.
//
// Works on any item shaped like { choice_a, choice_b, choice_c, choice_d,
// correct_choice: "A"|"B"|"C"|"D" } and mutates/returns the same array.

const LETTERS = ['A', 'B', 'C', 'D'] as const;
type Letter = (typeof LETTERS)[number];

// deno-lint-ignore no-explicit-any
export function rebalanceCorrect<T extends Record<string, any>>(items: T[]): T[] {
  if (!Array.isArray(items)) return items;
  const recent: string[] = [];
  for (const item of items) {
    const cur = String(item.correct_choice ?? '').toUpperCase();
    if (!LETTERS.includes(cur as Letter)) continue;

    const correctText = item[`choice_${cur.toLowerCase()}`];
    const distractors = LETTERS.filter((l) => l !== cur).map(
      (l) => item[`choice_${l.toLowerCase()}`],
    );

    // If the last two correct letters are identical, that letter is forbidden
    // for this item — guaranteeing no run of 3+.
    const lastTwoSame =
      recent.length >= 2 && recent[recent.length - 1] === recent[recent.length - 2];
    const forbidden = lastTwoSame ? recent[recent.length - 1] : null;
    const candidates = LETTERS.filter((l) => l !== forbidden);
    const target = candidates[Math.floor(Math.random() * candidates.length)];

    let di = 0;
    for (const l of LETTERS) {
      item[`choice_${l.toLowerCase()}`] = l === target ? correctText : distractors[di++];
    }
    item.correct_choice = target;
    recent.push(target);
  }
  return items;
}
