import { handlePreflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/client.ts';
import { getMe } from '../_shared/auth.ts';
import { stripe } from '../_shared/stripe.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';
import { mapPriceIdToTier, type Tier } from '../_shared/tier.ts';

// deno-lint-ignore no-explicit-any
function firstPriceId(sub: any): string | null {
  return sub?.items?.data?.[0]?.price?.id || null;
}

const syncCache = new Map<string, number>();
const COOLDOWN_MS = 2_000;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 100, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const userLimit = rateLimitByUser(user.id, { maxRequests: 30, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  const lastSync = syncCache.get(user.id);
  if (lastSync && Date.now() - lastSync < COOLDOWN_MS) {
    console.log(`[sync] ${user.email} hit ${COOLDOWN_MS}ms cooldown — returning cached row values`);
    return json({
      cached: true,
      subscription_status: user.subscription_status,
      subscription_tier: user.subscription_tier,
      tier: user.tier,
      debug: { step: 'cooldown', email: user.email },
    });
  }
  syncCache.set(user.id, Date.now());

  const admin = adminClient();
  const customers = await stripe.customers.list({ email: user.email, limit: 1 });
  console.log(`[sync] ${user.email}: ${customers.data.length} Stripe customer(s) matched by email`);
  if (customers.data.length === 0) {
    await admin.from('users')
      .update({ subscription_status: 'free', subscription_tier: 'free', tier: 'free' })
      .eq('id', user.id);
    return json({
      subscription_status: 'free', subscription_tier: 'free', tier: 'free',
      debug: { step: 'no_customer', email: user.email, note: 'No Stripe customer with this exact email — checkout may have used a different email.' },
    });
  }

  const customer = customers.data[0];
  const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 100, status: 'all' });
  const subSummary = subs.data.map((s) => ({
    id: s.id,
    status: s.status,
    priceId: firstPriceId(s),
    cancel_at: s.cancel_at ? new Date(s.cancel_at * 1000).toISOString() : null,
  }));
  console.log(`[sync] ${user.email}: customer ${customer.id}, ${subs.data.length} subscription(s):`, JSON.stringify(subSummary));

  let status = 'free';
  let tier = 'free';
  let newTier: Tier = 'free';
  const update: Record<string, unknown> = {};

  const active = subs.data.filter((s) => s.status === 'active' || s.status === 'trialing');
  if (active.length > 0) {
    const latest = active[0];
    const inTrial = latest.trial_end && new Date(latest.trial_end * 1000) > new Date();
    status = inTrial ? 'trial' : 'premium';
    tier = 'premium';
    newTier = mapPriceIdToTier(firstPriceId(latest));
    if (inTrial) update.trial_end_date = new Date(latest.trial_end! * 1000).toISOString();
  } else {
    const canceled = subs.data.filter((s) => s.status === 'past_due' || s.cancel_at);
    if (canceled.length > 0 && canceled[0].current_period_end) {
      status = 'grace_period';
      tier = 'premium';
      newTier = mapPriceIdToTier(firstPriceId(canceled[0]));
      update.grace_period_end_date = new Date(canceled[0].current_period_end * 1000).toISOString();
    }
  }

  if (newTier !== 'free') {
    update.tier_started_at = new Date().toISOString();
  }

  console.log(`[sync] ${user.email}: mapped tier=${newTier}, status=${status}`);
  const { error: updateError } = await admin.from('users').update({
    subscription_status: status,
    subscription_tier: tier,
    tier: newTier,
    last_subscription_update: new Date().toISOString(),
    ...update,
  }).eq('id', user.id);
  if (updateError) {
    console.error(`[sync] ${user.email}: users row update FAILED:`, updateError.message);
  }

  return json({
    subscription_status: status,
    subscription_tier: tier,
    tier: newTier,
    debug: {
      step: 'synced',
      email: user.email,
      customerId: customer.id,
      subscriptions: subSummary,
      mappedTier: newTier,
      dbUpdateError: updateError?.message || null,
    },
  });
});
