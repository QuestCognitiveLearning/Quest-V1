/**
 * @file   checkDueReviews/index.ts
 * @desc   Scheduled daily job: creates Notification rows for overdue
 *         reviews/assignments and sends a single grouped email per affected
 *         student.
 *
 *         Auth model: deployed with --no-verify-jwt (so Supabase's JWT
 *         gateway lets anonymous requests through), then gated by a
 *         CRON_SHARED_SECRET header. Cron jobs include
 *         `x-cron-secret: <value>` on every invocation. Anonymous callers
 *         without the secret get a 403.
 *
 * @author Quest Learning core team
 */
import { handlePreflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/client.ts';
import { sendEmail } from '../_shared/email.ts';
import { overdueHtml, OverdueItem } from '../_shared/overdueTemplate.ts';
import { clientIp, rateLimitByIp, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

const CRON_SHARED_SECRET = Deno.env.get('CRON_SHARED_SECRET') ?? '';

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Strict per-IP rate limit — this endpoint should fire at most once per
  // day from your cron. Anything beyond a handful of requests is abuse.
  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 5, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  // Defense against abuse: anyone can hit this URL because we deploy with
  // --no-verify-jwt, so we check a shared secret instead. Reject early.
  if (!CRON_SHARED_SECRET) {
    console.error('[checkDueReviews] CRON_SHARED_SECRET not configured — blocking all requests');
    return json({ error: 'forbidden' }, 403);
  }
  const supplied = req.headers.get('x-cron-secret') ?? '';
  if (supplied !== CRON_SHARED_SECRET) {
    return json({ error: 'forbidden' }, 403);
  }

  const admin = adminClient();

  const [
    { data: progressRows = [] },
    { data: users = [] },
    { data: subunits = [] },
    { data: assignments = [] },
    { data: enrollments = [] },
  ] = await Promise.all([
    admin.from('student_progress').select('*').limit(1000),
    admin.from('users').select('*').limit(1000),
    admin.from('subunits').select('*').limit(1000),
    admin.from('assignments').select('*').limit(1000),
    admin.from('student_enrollments').select('*').limit(1000),
  ]);

  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]));
  const subunitMap = Object.fromEntries((subunits ?? []).map((s) => [s.id, s]));

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);

  let notificationsCreated = 0;
  let emailsSent = 0;
  const overdueByStudent: Record<string, { student: { email: string; full_name: string }; items: OverdueItem[] }> = {};

  for (const progress of progressRows ?? []) {
    if (!progress.next_review_date) continue;
    const reviewStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(progress.next_review_date));
    const dueToday = reviewStr === todayStr;
    const overdue = reviewStr < todayStr;
    if (!dueToday && !overdue) continue;

    const student = userMap[progress.student_id];
    const subunit = subunitMap[progress.subunit_id];
    if (!student || !subunit) continue;

    if (dueToday) {
      await admin.from('notifications').insert({
        user_id: progress.student_id,
        type: 'review_due',
        title: `Review: ${subunit.subunit_name}`,
        message: `Due today — complete your review.`,
        subunit_id: progress.subunit_id,
        read: false,
        action_url: `/PracticeSession?topic=${progress.subunit_id}`,
      });
      notificationsCreated++;
    }
    if (overdue) {
      const days = Math.floor((now.getTime() - new Date(progress.next_review_date).getTime()) / 86_400_000);
      overdueByStudent[progress.student_id] ??= { student, items: [] };
      overdueByStudent[progress.student_id].items.push({ name: subunit.subunit_name, daysOverdue: days, type: 'review' });
    }
  }

  for (const a of assignments ?? []) {
    if (!a.due_date || !a.subunit_id || !a.class_id) continue;
    const dueStr = String(a.due_date).substring(0, 10);
    const dueToday = dueStr === todayStr;
    const overdue = dueStr < todayStr;
    if (!dueToday && !overdue) continue;

    const subunit = subunitMap[a.subunit_id];
    if (!subunit) continue;
    const enrolled = (enrollments ?? []).filter((e) => e.class_id === a.class_id);

    for (const e of enrolled) {
      const student = userMap[e.student_id];
      if (!student) continue;
      const progress = (progressRows ?? []).find((p) => p.student_id === e.student_id && p.subunit_id === a.subunit_id);
      if (progress?.new_session_completed) continue;

      if (dueToday) {
        await admin.from('notifications').insert({
          user_id: e.student_id,
          type: 'review_due',
          title: `New Topic: ${subunit.subunit_name}`,
          message: `Due today — start your learning session.`,
          subunit_id: a.subunit_id,
          read: false,
          action_url: `/NewSession?topic=${a.subunit_id}`,
        });
        notificationsCreated++;
      }
      if (overdue) {
        const days = Math.floor((now.getTime() - new Date(dueStr + 'T00:00:00').getTime()) / 86_400_000);
        overdueByStudent[e.student_id] ??= { student, items: [] };
        overdueByStudent[e.student_id].items.push({ name: subunit.subunit_name, daysOverdue: days, type: 'assignment' });
      }
    }
  }

  for (const { student, items } of Object.values(overdueByStudent)) {
    try {
      await sendEmail({
        to: student.email,
        subject: 'You have missing assignments overdue',
        html: overdueHtml(student.full_name, items),
      });
      emailsSent++;
    } catch (err) {
      console.error(`Failed to send overdue email to ${student.email}:`, (err as Error).message);
    }
  }

  return json({
    success: true,
    notificationsCreated,
    emailsSent,
    todayStr,
    message: `Checked ${(progressRows ?? []).length} progress rows + ${(assignments ?? []).length} assignments.`,
  });
});
