import { handlePreflight, json } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { stripe } from '../_shared/stripe.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 100, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const userLimit = rateLimitByUser(user.id, { maxRequests: 30, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  const customers = await stripe.customers.list({ email: user.email, limit: 1 });
  if (customers.data.length === 0) {
    return json({ error: 'No Stripe customer found' }, 404);
  }

  // Optional same-origin return path so students land back on their own page
  // (defaults to the teacher settings page for backwards compatibility).
  let returnPath = '/teacher/settings';
  try {
    const body = await req.json();
    const candidate = body?.returnPath;
    if (typeof candidate === 'string' && candidate.startsWith('/') && !candidate.startsWith('//')) {
      returnPath = candidate;
    }
  } catch (_) { /* no body — keep default */ }

  const session = await stripe.billingPortal.sessions.create({
    customer: customers.data[0].id,
    return_url: `${req.headers.get('origin')}${returnPath}`,
  });

  return json({ url: session.url });
});
