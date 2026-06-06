// claimLeadHandouts — authenticated endpoint the dashboard calls on first
// load so any /try lead handouts the user generated under their email get
// imported into their account. Re-callable; idempotent.

import { handlePreflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/client.ts';
import { getMe } from '../_shared/auth.ts';
import { importLeadsForUser } from '../_shared/importLeads.ts';
import { clientIp, rateLimitByIp, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 30, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  if (!user.email) return json({ ok: true, imported: 0 });

  const admin = adminClient();
  const result = await importLeadsForUser(admin, user.id, user.email);
  return json({ ok: true, ...result });
});
