// Shared helper: maps a Stripe price ID (from a subscription's first
// line item) to the Quest tier enum. Falls back to the legacy single-tier
// behavior when env vars are unset so existing customers keep working.

export type Tier = 'free' | 'student' | 'classroom';

// Student Pro price IDs, kept in sync with getStripePrices' fallbacks so a
// missing env var can't silently misclassify a paying student as classroom.
// Includes the archived $9.99 price so early subscribers still map correctly.
const STUDENT_PRICE_FALLBACKS = [
  'price_1Tg9HCK8xO8FkG1xxRos8YRk', // Student Pro $9/mo
  'price_1Tg9p0K8xO8FkG1xgeKSfGng', // Student Pro $89/yr
  'price_1Tg98mK8xO8FkG1xHeohb4iU', // Student Pro $9.99/mo (archived 2026-06-08)
];

export function mapPriceIdToTier(priceId: string | null | undefined): Tier {
  if (!priceId) return 'free';
  const studentMonthly   = Deno.env.get('STRIPE_PRICE_STUDENT_MONTHLY');
  const studentAnnual    = Deno.env.get('STRIPE_PRICE_STUDENT_ANNUAL');
  const classroomMonthly = Deno.env.get('STRIPE_PRICE_CLASSROOM_MONTHLY');
  const classroomAnnual  = Deno.env.get('STRIPE_PRICE_CLASSROOM_ANNUAL');

  if (priceId === studentMonthly || priceId === studentAnnual) return 'student';
  if (STUDENT_PRICE_FALLBACKS.includes(priceId)) return 'student';
  if (priceId === classroomMonthly || priceId === classroomAnnual) return 'classroom';
  // Unknown / legacy price → treat as classroom so existing premium
  // subscribers keep their full feature set.
  return 'classroom';
}
