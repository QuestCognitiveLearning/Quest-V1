// Stripe Checkout session creator.
// Hardened: per-IP + per-user rate limiting, strict input validation.
import { handlePreflight, json } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { stripe } from '../_shared/stripe.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';
import { validate } from '../_shared/validator.ts';

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  // OWASP: rate-limit financial endpoints aggressively before auth + before work.
  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 100, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const userLimit = rateLimitByUser(user.id, { maxRequests: 10, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  // Strict validation: reject unknown fields, enforce shape & limits.
  const { ok, value, errors } = validate(await req.json(), {
    priceId:    { type: 'string', required: true, maxLength: 64, pattern: /^price_[A-Za-z0-9]+$/ },
    successUrl: { type: 'url', required: true },
    cancelUrl:  { type: 'url', required: true },
  });
  if (!ok) return json({ error: 'Invalid request', details: errors }, 400);

  // Find or create the Stripe customer for this user.
  let customerId: string;
  const customers = await stripe.customers.list({ email: user.email, limit: 1 });
  if (customers.data.length > 0) {
    customerId = customers.data[0].id;
    if (!customers.data[0].metadata?.app_user_id) {
      await stripe.customers.update(customerId, { metadata: { app_user_id: user.id } });
    }
  } else {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.full_name,
      metadata: { app_user_id: user.id },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: value.priceId, quantity: 1 }],
    mode: 'subscription',
    subscription_data: {
      trial_period_days: 30,
      metadata: { app_user_id: user.id },
    },
    success_url: value.successUrl,
    cancel_url: value.cancelUrl,
    allow_promotion_codes: true,
    metadata: { app_user_id: user.id },
  });

  return json({ url: session.url });
});
