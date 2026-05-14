import { handlePreflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/client.ts';
import { getMe } from '../_shared/auth.ts';
import { stripe } from '../_shared/stripe.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

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
    return json({
      cached: true,
      subscription_status: user.subscription_status,
      subscription_tier: user.subscription_tier,
    });
  }
  syncCache.set(user.id, Date.now());

  const admin = adminClient();
  const customers = await stripe.customers.list({ email: user.email, limit: 1 });
  if (customers.data.length === 0) {
    await admin.from('users')
      .update({ subscription_status: 'free', subscription_tier: 'free' })
      .eq('id', user.id);
    return json({ subscription_status: 'free', subscription_tier: 'free' });
  }

  const customer = customers.data[0];
  const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 100, status: 'all' });

  let status = 'free';
  let tier = 'free';
  const update: Record<string, unknown> = {};

  const active = subs.data.filter((s) => s.status === 'active' || s.status === 'trialing');
  if (active.length > 0) {
    const latest = active[0];
    const inTrial = latest.trial_end && new Date(latest.trial_end * 1000) > new Date();
    status = inTrial ? 'trial' : 'premium';
    tier = 'premium';
    if (inTrial) update.trial_end_date = new Date(latest.trial_end! * 1000).toISOString();
  } else {
    const canceled = subs.data.filter((s) => s.status === 'past_due' || s.cancel_at);
    if (canceled.length > 0 && canceled[0].current_period_end) {
      status = 'grace_period';
      tier = 'premium';
      update.grace_period_end_date = new Date(canceled[0].current_period_end * 1000).toISOString();
    }
  }

  await admin.from('users').update({
    subscription_status: status,
    subscription_tier: tier,
    last_subscription_update: new Date().toISOString(),
    ...update,
  }).eq('id', user.id);

  return json({ subscription_status: status, subscription_tier: tier });
});
