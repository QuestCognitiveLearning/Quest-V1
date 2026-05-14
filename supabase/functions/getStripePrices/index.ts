/**
 * @file   getStripePrices/index.ts
 * @desc   Public endpoint that returns Stripe price IDs for the Pricing page.
 *         No auth required — the IDs themselves are not secrets. IP-rate-
 *         limited so a hot loop can't burn through the edge-function quota.
 *
 *         TODO [config]: move price IDs to env vars
 *         (STRIPE_PRICE_PREMIUM_MONTHLY) so live vs. test isn't hardcoded
 *         and rotation doesn't require a code change.
 * @author Quest Learning core team
 */
import { handlePreflight, json } from '../_shared/cors.ts';
import { clientIp, rateLimitByIp, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

Deno.serve((req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Public endpoint — IP-only limit. Pricing page calls this once on load.
  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 60, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  return json({
    premium_price_id: 'price_1SsvWlK8xO8FkG1xlWNQUDDl',
    premium_product_id: 'prod_TqcAYSDsVBEGAG',
  });
});
