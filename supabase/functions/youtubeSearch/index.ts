// YouTube Data API v3 proxy. Rate-limited (YouTube quota is shared, so we
// cap per user) and validates inputs to avoid SSRF / quota-burn shenanigans.
import { handlePreflight, json } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';
import { validate } from '../_shared/validator.ts';

const API_KEY = Deno.env.get('YOUTUBE_API_KEY')!;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{6,15}$/;

// Minimum video duration (seconds) returned by the `search` action. 60s
// matches the YouTube Shorts upper bound — anything ≤60s is treated as a
// Short or trailer clip and excluded. Long-form content only.
const MIN_DURATION_SECONDS = 60;

/**
 * Parse an ISO-8601 duration string (e.g. "PT4M13S") into seconds.
 * Returns 0 if the string is missing or unparseable.
 */
function parseIsoDurationSeconds(iso: string): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] ?? '0', 10);
  const min = parseInt(m[2] ?? '0', 10);
  const s = parseInt(m[3] ?? '0', 10);
  return h * 3600 + min * 60 + s;
}

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
    // Over-fetch (15) so we can still return ~5 results after dropping Shorts
    // and sub-60s clips. YouTube's `videoDuration` enum is too coarse here —
    // `short` is <4 min (incl. 0-60s), `medium` is 4-20 min (excludes the
    // 1-4 min range a teacher may want). So pull the broader set and filter
    // by exact duration below.
    const searchUrl = `${base}/search?part=snippet&q=${encodeURIComponent(value.query)}&type=video&maxResults=15&key=${API_KEY}`;
    const sr = await fetch(searchUrl);
    if (!sr.ok) return json(await sr.json(), sr.status);
    const searchPayload = await sr.json();
    const items = (searchPayload.items as Array<{ id: { videoId: string } }>) ?? [];
    if (items.length === 0) return json(searchPayload, 200);

    // Pull contentDetails for the candidates so we can read each video's
    // ISO-8601 duration and decide whether to keep it.
    const ids = items
      .map((it) => it.id?.videoId)
      .filter((id): id is string => typeof id === 'string' && VIDEO_ID_RE.test(id));
    if (ids.length === 0) return json(searchPayload, 200);

    const detailsUrl = `${base}/videos?part=contentDetails&id=${ids.join(',')}&key=${API_KEY}`;
    const dr = await fetch(detailsUrl);
    if (!dr.ok) {
      // If the durations call fails, fall back to the raw search results
      // rather than blocking the user. The client-side filter in
      // VideoSearchModal still drops sub-60s items as a backstop.
      return json(searchPayload, 200);
    }
    const detailsPayload = await dr.json();
    const durationByVideoId = new Map<string, number>();
    for (const v of (detailsPayload.items as Array<{ id: string; contentDetails: { duration: string } }>) ?? []) {
      durationByVideoId.set(v.id, parseIsoDurationSeconds(v.contentDetails?.duration ?? ''));
    }

    // Long-form gate. Drop anything ≤60s (= Shorts / clips).
    const filtered = items
      .filter((it) => (durationByVideoId.get(it.id?.videoId ?? '') ?? 0) > MIN_DURATION_SECONDS)
      .slice(0, 5);

    return json({ ...searchPayload, items: filtered }, 200);
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
