// Dual-layer rate limiter (per-IP and per-user) for Supabase Edge Functions.
//
// Strategy
//   - Per-IP cap protects against distributed/anonymous attacks.
//   - Per-user cap protects against authenticated abuse (one user looping calls).
//   - A request must pass BOTH caps. The tighter wins.
//
// Storage
//   - In-memory Maps inside module scope. Edge Functions reuse the same
//     isolate across warm invocations, so counters persist for the lifetime
//     of the worker. Cold starts reset counters; that's acceptable because
//     the goal is throttling burst abuse, not perfect ledger accounting.
//     For long-window enforcement (per-day quotas, billing) wire Redis later.
//
// Response shape
//   429 with X-RateLimit-* and Retry-After headers — matches OWASP guidance.
//
// Usage
//   const ip = clientIp(req);
//   const r1 = rateLimitByIp(ip, { maxRequests: 100, windowMs: 60_000 });
//   if (!r1.allowed) return tooManyRequestsResponse(r1);
//   const r2 = rateLimitByUser(user.id, { maxRequests: 50, windowMs: 60_000 });
//   if (!r2.allowed) return tooManyRequestsResponse(r2);

import { corsHeaders } from './cors.ts';

interface Bucket { count: number; resetAt: number }
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
  retryAfter: number; // seconds
}

const ipBuckets: Map<string, Bucket> = new Map();
const userBuckets: Map<string, Bucket> = new Map();

function check(
  store: Map<string, Bucket>,
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  let bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }
  bucket.count += 1;
  const allowed = bucket.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - bucket.count);
  const resetMs = bucket.resetAt - now;
  return {
    allowed,
    remaining,
    resetMs,
    limit: maxRequests,
    retryAfter: Math.ceil(resetMs / 1000),
  };
}

export function rateLimitByIp(
  ip: string,
  opts: { maxRequests?: number; windowMs?: number } = {},
): RateLimitResult {
  const { maxRequests = 100, windowMs = 60_000 } = opts;
  return check(ipBuckets, ip, maxRequests, windowMs);
}

export function rateLimitByUser(
  userId: string,
  opts: { maxRequests?: number; windowMs?: number } = {},
): RateLimitResult {
  const { maxRequests = 50, windowMs = 60_000 } = opts;
  return check(userBuckets, userId, maxRequests, windowMs);
}

export function clientIp(req: Request): string {
  // Supabase forwards client IP in x-forwarded-for. Take the first hop.
  const xff = req.headers.get('x-forwarded-for') ?? '';
  return xff.split(',')[0].trim() || 'unknown';
}

export function tooManyRequestsResponse(r: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      retryAfter: r.retryAfter,
      resetTime: new Date(Date.now() + r.resetMs).toISOString(),
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(r.limit),
        'X-RateLimit-Remaining': String(r.remaining),
        'X-RateLimit-Reset': String(Math.ceil((Date.now() + r.resetMs) / 1000)),
        'Retry-After': String(r.retryAfter),
      },
    },
  );
}
