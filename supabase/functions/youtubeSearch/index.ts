// YouTube Data API v3 proxy. Rate-limited (YouTube quota is shared, so we
// cap per user) and validates inputs to avoid SSRF / quota-burn shenanigans.
import { handlePreflight, json } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';
import { validate } from '../_shared/validator.ts';

const API_KEY = Deno.env.get('YOUTUBE_API_KEY')!;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{6,15}$/;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 100, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const userLimit = rateLimitByUser(user.id, { maxRequests: 30, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  const { ok, value, errors } = validate(await req.json(), {
    action:   { type: 'enum', required: true, values: ['search', 'durations', 'videoDetails'] },
    query:    { type: 'string', maxLength: 200 },
    videoIds: { type: 'string', maxLength: 600 },     // comma-separated list
    videoId:  { type: 'string', maxLength: 20, pattern: VIDEO_ID_RE },
  });
  if (!ok) return json({ error: 'Invalid request', details: errors }, 400);

  const base = 'https://www.googleapis.com/youtube/v3';

  if (value.action === 'search') {
    if (!value.query) return json({ error: 'query required for search' }, 400);
    const url = `${base}/search?part=snippet&q=${encodeURIComponent(value.query)}&type=video&maxResults=5&key=${API_KEY}`;
    const r = await fetch(url);
    return json(await r.json(), r.ok ? 200 : r.status);
  }

  if (value.action === 'durations') {
    if (!value.videoIds) return json({ error: 'videoIds required' }, 400);
    // Whitelist each id; reject anything not matching YouTube id shape.
    const ids = value.videoIds.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (ids.some((id: string) => !VIDEO_ID_RE.test(id))) {
      return json({ error: 'videoIds contains an invalid id' }, 400);
    }
    if (ids.length > 50) return json({ error: 'too many videoIds' }, 400);
    const url = `${base}/videos?part=contentDetails&id=${ids.join(',')}&key=${API_KEY}`;
    const r = await fetch(url);
    return json(await r.json(), r.ok ? 200 : r.status);
  }

  if (value.action === 'videoDetails') {
    if (!value.videoId) return json({ error: 'videoId required' }, 400);
    const url = `${base}/videos?part=snippet,contentDetails&id=${value.videoId}&key=${API_KEY}`;
    const r = await fetch(url);
    return json(await r.json(), r.ok ? 200 : r.status);
  }

  return json({ error: 'Unknown action' }, 400);
});
