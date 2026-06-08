/**
 * @file   getStripePrices/index.ts
 * @desc   Public endpoint that returns Stripe price IDs for the Pricing page.
 *         No auth required — the IDs themselves are not secrets. IP-rate-
 *         limited so a hot loop can't burn through the edge-function quota.
 *
 *         Reads price IDs from env vars so live / test can be swapped without
 *         a code change. The legacy `premium_price_id` is kept in the
 *         response shape so existing callers (e.g. the /Try DownloadGate that
 *         still calls `pricesResp?.premium_price_id`) keep working — it now
 *         aliases STRIPE_PRICE_CLASSROOM_MONTHLY (the lowest-friction option)
 *         and falls back to the hardcoded legacy ID until env vars land.
 *
 * @author Quest Learning core team
 */
import { handlePreflight, json } from '../_shared/cors.ts';
import { clientIp, rateLimitByIp, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

const LEGACY_PRICE_ID = 'price_1TY7vGK8xO8FkG1xd8ArliXn';
// Student Pro — $9.00/mo recurring. Product prod_UfU6wkeqKeabHK.
// Original $9.99 price (price_1Tg98mK8xO8FkG1xHeohb4iU) was archived
// 2026-06-08 in favour of this $9.00 price. Env var override available
// via STRIPE_PRICE_STUDENT_MONTHLY.
const STUDENT_MONTHLY_FALLBACK = 'price_1Tg9HCK8xO8FkG1xxRos8YRk';
// Student Pro Annual — $89.00/yr recurring on the same product.
// Env var override available via STRIPE_PRICE_STUDENT_ANNUAL.
const STUDENT_ANNUAL_FALLBACK = 'price_1Tg9p0K8xO8FkG1xgeKSfGng';

Deno.serve((req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 60, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const classroomMonthly = Deno.env.get('STRIPE_PRICE_CLASSROOM_MONTHLY') || LEGACY_PRICE_ID;
  const classroomAnnual  = Deno.env.get('STRIPE_PRICE_CLASSROOM_ANNUAL')  || null;
  const studentMonthly   = Deno.env.get('STRIPE_PRICE_STUDENT_MONTHLY')   || STUDENT_MONTHLY_FALLBACK;
  const studentAnnual    = Deno.env.get('STRIPE_PRICE_STUDENT_ANNUAL')    || STUDENT_ANNUAL_FALLBACK;

  return json({
    premium_price_id: classroomMonthly,
    premium_product_id: 'prod_TqcAYSDsVBEGAG',
    tiers: {
      classroom: { monthly: classroomMonthly, annual: classroomAnnual },
      student:   { monthly: studentMonthly,   annual: studentAnnual },
    },
  });
});
