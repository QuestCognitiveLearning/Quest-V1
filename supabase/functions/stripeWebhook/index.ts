// Stripe webhook handler. Mirrors the Quest logic: keeps the user row's
// subscription_status / tier / dates in sync with what Stripe reports.
//
// Note: Edge Functions deployed with `--no-verify-jwt` are required for the
// webhook endpoint, since Stripe doesn't supply a Supabase JWT.

import { handlePreflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/client.ts';
import { getMe } from '../_shared/auth.ts';
import { stripe } from '../_shared/stripe.ts';
import { clientIp, rateLimitByIp, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
// Stripe burst-retries on transient failures; allow generous capacity but
// still cap to deflect amplification attempts using a stolen signature.
const WEBHOOK_IP_BUDGET = { maxRequests: 600, windowMs: 60_000 };

async function syncFromCustomer(userId: string) {
  const customers = await stripe.customers.list({ limit: 100 });
  const customer = customers.data.find((c) => c.metadata?.app_user_id === userId);
  if (!customer) return;
  const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 1, status: 'all' });

  let status = 'free';
  let tier = 'free';
  if (subs.data.length > 0) {
    const sub = subs.data[0];
    if (sub.status === 'active' || sub.status === 'trialing') {
      const inTrial = sub.trial_end && new Date(sub.trial_end * 1000) > new Date();
      status = inTrial ? 'trial' : 'premium';
      tier = 'premium';
    }
  }
  await adminClient().from('users').update({
    subscription_status: status,
    subscription_tier: tier,
    last_subscription_update: new Date().toISOString(),
  }).eq('id', userId);
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const ipLimit = rateLimitByIp(clientIp(req), WEBHOOK_IP_BUDGET);
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  // GET path: an authenticated user can pull their own status on demand.
  if (req.method === 'GET') {
    const user = await getMe(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const admin = adminClient();

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      await admin.from('users').update({
        subscription_status: 'free', subscription_tier: 'free',
      }).eq('id', user.id);
      return json({ subscription_status: 'free' });
    }

    const customer = customers.data[0];
    const subs = await stripe.subscriptions.list({ customer: customer.id, limit: 1, status: 'all' });

    let status = 'free';
    let tier = 'free';
    const update: Record<string, unknown> = {};
    const activeSub = subs.data.find((s) => s.status === 'active' || s.status === 'trialing');
    if (activeSub) {
      const inTrial = activeSub.trial_end && new Date(activeSub.trial_end * 1000) > new Date();
      status = inTrial ? 'trial' : 'premium';
      tier = 'premium';
      if (inTrial) update.trial_end_date = new Date(activeSub.trial_end! * 1000).toISOString();
    } else {
      const canceled = subs.data.find((s) => s.cancel_at || s.status === 'past_due');
      if (canceled?.current_period_end) {
        status = 'grace_period';
        tier = 'premium';
        update.grace_period_end_date = new Date(canceled.current_period_end * 1000).toISOString();
      }
    }

    await admin.from('users').update({
      subscription_status: status,
      subscription_tier: tier,
      last_subscription_update: new Date().toISOString(),
      ...update,
    }).eq('id', user.id);

    return json({ subscription_status: status, subscription_tier: tier });
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const signature = req.headers.get('stripe-signature');
  if (!signature) return json({ error: 'Missing signature' }, 400);

  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
  } catch {
    return json({ error: 'Signature verification failed' }, 400);
  }

  const admin = adminClient();

  const extractUserId = async (
    obj: { metadata?: Record<string, string>; customer?: string | { id: string } },
  ): Promise<string | null> => {
    let userId = obj.metadata?.app_user_id || obj.metadata?.user_id;
    if (!userId && obj.customer) {
      try {
        const cust = await stripe.customers.retrieve(
          typeof obj.customer === 'string' ? obj.customer : obj.customer.id,
        );
        userId = (cust as { metadata?: Record<string, string> }).metadata?.app_user_id;
      } catch (_) { /* ignore */ }
    }
    if (!userId || typeof userId !== 'string' || userId.length > 255) return null;
    return userId;
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Record<string, unknown>;
      const userId = await extractUserId(session as Parameters<typeof extractUserId>[0]);
      if (!userId) break;

      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);

      await admin.from('users').update({
        subscription_status: 'trial',
        subscription_tier: 'premium',
        subscription_id: session.subscription,
        trial_end_date: trialEnd.toISOString(),
        last_subscription_update: new Date().toISOString(),
      }).eq('id', userId);
      await syncFromCustomer(userId);
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Record<string, unknown>;
      const userId = await extractUserId(sub as Parameters<typeof extractUserId>[0]);
      if (!userId) break;

      let status = 'free';
      let tier = 'free';
      const update: Record<string, unknown> = {};

      if (sub.cancel_at) {
        const ends = new Date((sub.current_period_end as number) * 1000);
        status = 'grace_period';
        tier = 'premium';
        update.grace_period_end_date = ends.toISOString();
      } else if (sub.status === 'active') {
        const trialEnd = sub.trial_end as number | null;
        const inTrial = trialEnd && new Date(trialEnd * 1000) > new Date();
        status = inTrial ? 'trial' : 'premium';
        tier = 'premium';
      }

      await admin.from('users').update({
        subscription_status: status,
        subscription_tier: tier,
        last_subscription_update: new Date().toISOString(),
        ...update,
      }).eq('id', userId);
      await syncFromCustomer(userId);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Record<string, unknown>;
      const userId = await extractUserId(sub as Parameters<typeof extractUserId>[0]);
      if (!userId) break;

      const ends = new Date((sub.current_period_end as number) * 1000);
      await admin.from('users').update({
        subscription_status: 'grace_period',
        subscription_tier: 'premium',
        subscription_id: null,
        grace_period_end_date: ends.toISOString(),
        last_subscription_update: new Date().toISOString(),
      }).eq('id', userId);
      await syncFromCustomer(userId);
      break;
    }

    default:
      console.log('Unhandled event type:', event.type);
  }

  return json({ received: true });
});
