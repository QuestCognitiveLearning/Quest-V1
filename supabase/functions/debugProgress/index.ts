import { handlePreflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/client.ts';
import { clientIp, rateLimitByIp, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Internal debug helper. Strict IP limit — should rarely be called.
  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 30, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const admin = adminClient();
  const { data, error } = await admin
    .from('student_progress')
    .select('id, next_review_date')
    .not('next_review_date', 'is', null)
    .limit(1000);
  if (error) return json({ error: error.message }, 500);

  const now = new Date();
  const results = (data ?? []).map((p) => {
    const reviewDate = new Date(p.next_review_date);
    const daysUntil = (reviewDate.getTime() - now.getTime()) / 86_400_000;
    return {
      id: p.id,
      next_review_date: p.next_review_date,
      daysUntil: daysUntil.toFixed(2),
      isDueToday: daysUntil >= -1 && daysUntil <= 1,
      isOverdue: daysUntil < -1,
    };
  });

  return json({ now: now.toISOString(), results });
});
