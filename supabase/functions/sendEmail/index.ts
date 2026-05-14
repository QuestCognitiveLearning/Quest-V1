// Generic email endpoint mirroring Quest's Core.SendEmail signature.
import { handlePreflight, json } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { sendEmail } from '../_shared/email.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Email is abuse-prone (spam vector). Tight per-user cap.
  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 60, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const userLimit = rateLimitByUser(user.id, { maxRequests: 10, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  const { to, subject, body, from_name } = await req.json();
  if (!to || !subject) return json({ error: 'to and subject required' }, 400);

  const result = await sendEmail({
    to,
    subject,
    html: body ?? '',
  });
  return json({ status: 'sent', ...result, from_name: from_name ?? 'Quest Learning' });
});
