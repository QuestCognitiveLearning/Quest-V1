// Shared helper: maps a Stripe price ID (from a subscription's first
// line item) to the Quest tier enum. Falls back to the legacy single-tier
// behavior when env vars are unset so existing customers keep working.

export type Tier = 'free' | 'student' | 'classroom';

export function mapPriceIdToTier(priceId: string | null | undefined): Tier {
  if (!priceId) return 'free';
  const studentMonthly   = Deno.env.get('STRIPE_PRICE_STUDENT_MONTHLY');
  const classroomMonthly = Deno.env.get('STRIPE_PRICE_CLASSROOM_MONTHLY');
  const classroomAnnual  = Deno.env.get('STRIPE_PRICE_CLASSROOM_ANNUAL');

  if (priceId === studentMonthly) return 'student';
  if (priceId === classroomMonthly || priceId === classroomAnnual) return 'classroom';
  // Unknown / legacy price → treat as classroom so existing premium
  // subscribers keep their full feature set.
  return 'classroom';
}
