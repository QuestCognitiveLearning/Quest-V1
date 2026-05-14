import { handlePreflight, json } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

const API_KEY = Deno.env.get('COMMON_STANDARDS_API_KEY')!;
const BASE = 'https://api.commonstandardsproject.com/api/v1';

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Upstream API has its own quota — throttle here to protect it.
  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 100, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const userLimit = rateLimitByUser(user.id, { maxRequests: 30, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  const { action, jurisdictionId, standardSetId } = await req.json();
  const headers = { 'Api-Key': API_KEY };

  if (action === 'list') {
    const res = await fetch(`${BASE}/jurisdictions`, { headers });
    if (!res.ok) return json({ error: 'Failed to fetch jurisdictions', details: await res.text() }, 500);
    const data = await res.json();
    return json({ jurisdictions: data.data ?? [] });
  }

  if (action === 'getJurisdiction') {
    const res = await fetch(`${BASE}/jurisdictions/${jurisdictionId}`, { headers });
    if (!res.ok) return json({ error: 'Failed to fetch jurisdiction', details: await res.text() }, 500);
    const data = await res.json();
    return json({ jurisdiction: data.data });
  }

  if (action === 'fetch') {
    const res = await fetch(`${BASE}/standard_sets/${standardSetId}`, { headers });
    if (!res.ok) return json({ error: 'Failed to fetch standard set', details: await res.text() }, 500);
    const data = await res.json();
    return json({ standardSet: data.data });
  }

  return json({ error: 'Invalid action' }, 400);
});
