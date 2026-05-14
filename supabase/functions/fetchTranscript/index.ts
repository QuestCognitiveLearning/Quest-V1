import { handlePreflight, json } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { adminClient } from '../_shared/client.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

const API_KEY = Deno.env.get('TRANSCRIPTAPI_KEY')!;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  // TranscriptAPI has rate limits + per-call costs — protect them.
  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 100, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const userLimit = rateLimitByUser(user.id, { maxRequests: 30, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  const { videoId } = await req.json();
  if (!videoId) return json({ error: 'videoId is required' }, 400);

  // Retry up to 3 times; TranscriptAPI sometimes needs a moment on first hit.
  let payload: unknown = null;
  let lastError: string | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(
      `https://transcriptapi.com/api/v2/youtube/transcript?video_url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { headers: { Authorization: `Bearer ${API_KEY}` } },
    );
    if (res.ok) {
      payload = await res.json();
      break;
    }
    lastError = await res.text();
    if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
  }

  if (!payload) {
    return json({ error: 'Failed to fetch transcript', details: lastError }, 500);
  }

  // Handle the varied response shapes the API returns.
  const p = payload as Record<string, unknown>;
  const captions: Array<{ text?: string; content?: string; start?: number; timestamp?: number }> =
    (p.transcript as []) ?? (p.data as []) ?? (Array.isArray(payload) ? payload : []) ?? (p.captions as []) ?? [];

  if (captions.length === 0) {
    return json({ transcript: '', timestampedSegments: [] });
  }

  const transcript = captions.map((c) => c.text ?? c.content ?? '').join(' ');
  const timestampedSegments = captions.map((c) => ({
    timestamp: c.start ?? c.timestamp ?? 0,
    text: c.text ?? c.content ?? '',
  }));

  // Upload to Supabase Storage so the transcript has a stable URL.
  let transcriptUrl: string | null = null;
  try {
    const admin = adminClient();
    const path = `transcripts/${videoId}-${Date.now()}.txt`;
    const { error: upErr } = await admin.storage
      .from('public-uploads')
      .upload(path, new Blob([transcript], { type: 'text/plain' }), { upsert: true });
    if (!upErr) {
      const { data } = admin.storage.from('public-uploads').getPublicUrl(path);
      transcriptUrl = data.publicUrl;
    }
  } catch (err) {
    console.warn('Transcript upload skipped:', (err as Error).message);
  }

  return json({ transcript, timestampedSegments, transcriptUrl });
});
