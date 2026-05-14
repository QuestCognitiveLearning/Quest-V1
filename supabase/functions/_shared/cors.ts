/**
 * @file   cors.ts
 * @desc   CORS preflight + response helpers. Allowlist mode by default — only
 *         our known origins (production canonical, redirect alias, dev) get
 *         Access-Control-Allow-Origin echoed back. Unknown origins receive the
 *         canonical production origin, which means their browsers' CORS check
 *         fails and the call is blocked.
 *
 *         Stripe webhook is the one exception: it calls our edge function
 *         server-to-server without an Origin header, so corsHeadersFor()
 *         defaults are fine for it too.
 *
 *         Also exposes `safeErrorResponse()` for masking internal error
 *         details from clients while logging server-side with a correlation ID.
 *
 * @author Quest Learning core team
 */

// Origins we accept calls from. Everything else gets the canonical origin in
// its CORS header, which fails its browser-side same-origin check.
//
// As of 2026-05-13 the primary domain is questlearning.co. The old
// quest-learn.com origins are kept temporarily so any users on cached pages
// still get successful CORS responses while DNS finishes propagating; remove
// them once you confirm no one is still hitting the old origin.
const ALLOWED_ORIGINS = new Set<string>([
  'https://www.questlearning.co',
  'https://questlearning.co',
  'https://quest-learning-ecru.vercel.app',     // vercel preview alias
  'https://www.quest-learn.com',                // legacy — remove later
  'https://quest-learn.com',                    // legacy — remove later
  'http://localhost:5173',
  'http://localhost:4173', // vite preview
]);

const CANONICAL_ORIGIN = 'https://www.questlearning.co';

/**
 * Build CORS headers scoped to the request's origin. If the origin isn't in
 * the allowlist, the canonical production origin is returned, which has the
 * effect of blocking the browser from accepting the response.
 */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : CANONICAL_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, stripe-signature',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

// Static export for legacy call-sites that imported `corsHeaders` directly.
// Falls back to canonical origin since we don't have a Request to inspect.
// Prefer `corsHeadersFor(req)` going forward.
export const corsHeaders = {
  'Access-Control-Allow-Origin': CANONICAL_ORIGIN, // https://www.questlearning.co
  'Vary': 'Origin',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/**
 * Handle CORS preflight. Returns a 200-with-headers Response for OPTIONS
 * requests, or null for everything else (continue normal flow).
 */
export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) });
  }
  return null;
}

/**
 * Standard JSON response with CORS + Content-Type set. Accepts an optional
 * `req` so per-request CORS headers can be emitted; callers without a Request
 * in scope fall back to the canonical-origin headers.
 */
export function json(body: unknown, status = 200, req?: Request): Response {
  const headers = req ? corsHeadersFor(req) : corsHeaders;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

/**
 * Mask internal error detail from the client; log it server-side with a
 * correlation ID so support can match user reports to logs without exposing
 * stack traces or upstream errors.
 */
export function safeErrorResponse(
  err: unknown,
  userMessage = 'Something went wrong. Please try again.',
  status = 500,
  req?: Request,
): Response {
  const correlationId = crypto.randomUUID();
  console.error(`[error ${correlationId}]`, err);
  return json({ error: userMessage, correlationId }, status, req);
}
