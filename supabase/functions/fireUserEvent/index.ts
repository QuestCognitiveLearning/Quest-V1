// Public Edge Function the app calls when a logged-in user does something
// that should advance the lifecycle drip (first class created, first student
// quiz submission, etc.). Auth = the user's Supabase JWT. We resolve the
// user's email server-side and forward to handleEventTrigger with the
// internal shared-secret header, which the browser never sees.

import { handlePreflight, json } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';
import { fireEvent } from '../_shared/fireEvent.ts';

// Only these events can be fired from the browser. Anything else
// (subscription_created, trial_started, etc.) must come from the server side.
const ALLOWED_EVENTS = new Set([
  'first_class_created',
  'first_student_quiz_submission',
]);

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 60, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const userLimit = rateLimitByUser(user.id, { maxRequests: 20, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  let body: { event?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const event = body.event || '';
  if (!ALLOWED_EVENTS.has(event)) {
    return json({ error: 'Event not allowed from client' }, 400);
  }
  if (!user.email) return json({ error: 'No email on user' }, 400);

  await fireEvent(user.email.toLowerCase(), event, {
    ...(body.payload || {}),
    firstName: user.full_name ? String(user.full_name).split(' ')[0] : null,
    userId: user.id,
  });

  return json({ ok: true });
});
