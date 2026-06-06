// Shared helper: maps a Stripe price ID (from a subscription's first
// line item) to the Quest tier enum. Falls back to the legacy single-tier
// behavior when env vars are unset so existing customers keep working.

export type Tier = 'free' | 'classroom' | 'studio' | 'enterprise';

export function mapPriceIdToTier(priceId: string | null | undefined): Tier {
  if (!priceId) return 'free';
  const classroomMonthly = Deno.env.get('STRIPE_PRICE_CLASSROOM_MONTHLY');
  const classroomAnnual  = Deno.env.get('STRIPE_PRICE_CLASSROOM_ANNUAL');
  const studioMonthly    = Deno.env.get('STRIPE_PRICE_STUDIO_MONTHLY');
  const studioAnnual     = Deno.env.get('STRIPE_PRICE_STUDIO_ANNUAL');
  const studioSeat       = Deno.env.get('STRIPE_PRICE_STUDIO_SEAT');

  if (priceId === classroomMonthly || priceId === classroomAnnual) return 'classroom';
  if (priceId === studioMonthly || priceId === studioAnnual || priceId === studioSeat) return 'studio';
  // Unknown / legacy price → treat as classroom so existing premium
  // subscribers keep their full feature set.
  return 'classroom';
}
