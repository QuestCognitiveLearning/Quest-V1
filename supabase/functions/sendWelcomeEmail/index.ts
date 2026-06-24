import { handlePreflight, json } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { sendEmail, signOff, keepUsingQuestHtml } from '../_shared/email.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

function welcomeHtml(name: string): string {
  return `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h1 style="color: #1a1a1a; text-align: center; margin-bottom: 30px;">Welcome to Quest Learning, ${name}! 🚀</h1>
  <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
    You're all set. Quest helps you actually understand each topic &mdash; with a short video, a quiz, and a tutor that thinks through ideas with you.
  </p>
  <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 30px; margin-bottom: 15px;">Here's how it works:</h2>
  <ul style="font-size: 15px; line-height: 1.8; margin-left: 20px;">
    <li><strong>Join your class</strong> with the code from your teacher</li>
    <li><strong>Learn each topic</strong> through a video, quiz, and case study</li>
    <li><strong>Chat with the Panda Tutor</strong> &mdash; it guides you with questions, not answers</li>
    <li><strong>Watch your knowledge map</strong> fill in as you complete topics</li>
  </ul>
  ${keepUsingQuestHtml()}
  <p style="font-size: 15px; margin-top: 25px; color: #666;">Happy learning!<br><strong>&mdash; ${signOff()}</strong></p>
</div>`;
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Welcome emails fire on signup. Tight per-user cap prevents abuse via
  // a compromised JWT spamming arbitrary student_email addresses.
  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 60, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const userLimit = rateLimitByUser(user.id, { maxRequests: 10, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  const { student_email, student_name } = await req.json();
  if (!student_email) return json({ error: 'student_email required' }, 400);

  await sendEmail({
    to: student_email,
    subject: 'Welcome to Quest Learning',
    html: welcomeHtml(student_name || 'there'),
  });

  return json({ success: true });
});
