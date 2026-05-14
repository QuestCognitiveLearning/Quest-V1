/**
 * @file   generateImage/index.ts
 * @desc   gpt-image-1 image generation. Rate-limited, validated, and returns
 *         a public Supabase Storage URL. Internal OpenAI / storage errors are
 *         masked from the client via safeErrorResponse.
 * @author Quest Learning core team
 */
import { handlePreflight, json, safeErrorResponse, corsHeadersFor } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { adminClient } from '../_shared/client.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';
import { validate } from '../_shared/validator.ts';
import { guardLLMRequest, logLLMUsage, guardFailureResponse } from '../_shared/llmGuard.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;
const BUCKET = 'public-uploads';
const IMAGE_MODEL = 'gpt-image-1';

// Rough token-equivalent cost for accounting purposes. Image gen doesn't
// return token usage; we estimate so the global token cap still applies.
// $0.07/image at gpt-image-1 medium ≈ 17,500 input-token-equivalents at
// gpt-4.1-mini pricing — close enough for circuit-breaker purposes.
const IMAGE_TOKEN_EQUIVALENT = 18_000;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const corsH = corsHeadersFor(req);

  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 60, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401, req);

  // Image generation is the single most expensive endpoint (cents per call).
  // 10/min/user is plenty for content creation while preventing abuse.
  const userLimit = rateLimitByUser(user.id, { maxRequests: 10, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  // Image generation = "heavy" tier action. Free users blocked, daily-cap
  // checked, global circuit breaker checked.
  const guard = await guardLLMRequest({ user, model: IMAGE_MODEL, action: 'heavy' });
  if (!guard.ok) return guardFailureResponse(guard, corsH);

  const { ok, value, errors } = validate(await req.json(), {
    prompt:  { type: 'string', required: true, minLength: 5, maxLength: 4000 },
    size:    { type: 'enum', values: ['1024x1024', '1536x1024', '1024x1536', 'auto'] },
    quality: { type: 'enum', values: ['low', 'medium', 'high', 'auto'] },
  });
  if (!ok) return json({ error: 'Invalid request', details: errors }, 400, req);

  // Auto-pick aspect ratio when caller didn't specify it.
  const lower = value.prompt.toLowerCase();
  const size = value.size ?? (
    lower.includes('1024×1792') || lower.includes('1024x1792') || lower.includes('portrait')
      ? '1024x1536'
      : lower.includes('1024×1024') || lower.includes('1024x1024') || lower.includes('square')
      ? '1024x1024'
      : '1536x1024'
  );

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: value.prompt,
      n: 1,
      size,
      // `medium` is visually near-identical to `high` for our 1024px hook
      // images and costs ~$0.07 vs $0.25. Callers can still override.
      quality: value.quality ?? 'medium',
    }),
  });
  if (!res.ok) {
    return safeErrorResponse(
      new Error(`OpenAI ${res.status}: ${await res.text()}`),
      'Failed to generate image. Please try again.',
    );
  }

  const data = await res.json();
  const b64: string | undefined = data.data?.[0]?.b64_json;
  if (!b64) {
    return safeErrorResponse(
      new Error('OpenAI returned no image data'),
      'Image generation failed.',
    );
  }

  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const path = `images/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

  const admin = adminClient();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'image/png', upsert: false });
  if (upErr) {
    return safeErrorResponse(
      new Error(`storage upload failed: ${upErr.message}`),
      'Failed to save generated image.',
    );
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

  // Audit-log AFTER success. Image generation doesn't report tokens, so we
  // record a flat token-equivalent that keeps the global circuit breaker honest.
  await logLLMUsage({
    userId: user.id,
    model: IMAGE_MODEL,
    inputTokens: 0,
    outputTokens: IMAGE_TOKEN_EQUIVALENT,
  });

  return json({ url: pub.publicUrl, revised_prompt: data.data?.[0]?.revised_prompt }, 200, req);
});
