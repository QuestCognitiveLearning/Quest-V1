// weeklyParentDigests — fires Sundays via pg_cron. For every Studio tutor,
// for every student of theirs who:
//   - Has parent_email_opted_in != false
//   - Has parent_email set
//   - Has had at least one ended session in the last 7 days
// enqueue a parent-progress-report digest. We reuse generateParentReport's
// flow by invoking it server-to-server with trigger_type='weekly_digest'.
//
// Auth: same internal-token pattern as processTimeTriggers.

import { handlePreflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/client.ts';

const INTERNAL_TOKEN = Deno.env.get('QUEST_INTERNAL_TOKEN') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const presented = req.headers.get('x-quest-internal-token');
  if (!INTERNAL_TOKEN || presented !== INTERNAL_TOKEN) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const db = adminClient();
  const summary = { tutors_checked: 0, digests_queued: 0, skipped: 0, errors: 0 };

  // 1) Find Studio + Enterprise tutors
  const { data: tutors } = await db
    .from('users')
    .select('id, email, full_name, new_role, tier')
    .in('tier', ['studio', 'enterprise']);

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - 7);
  const windowStartIso = windowStart.toISOString();

  for (const tutor of (tutors || []) as Row[]) {
    summary.tutors_checked++;
    try {
      // 2) Find this tutor's classes with ended sessions in the last 7 days
      const { data: classes } = await db
        .from('classes')
        .select('id, class_name, teacher_id, session_ended_at')
        .eq('teacher_id', tutor.id)
        .gte('session_ended_at', windowStartIso);

      if (!classes || classes.length === 0) {
        summary.skipped++;
        continue;
      }

      // 3) For each class, check the enrollment has a parent email + opt-in
      for (const klass of classes as Row[]) {
        const { data: enrollments } = await db
          .from('student_enrollments')
          .select('student_id, parent_email, parent_email_opted_in')
          .eq('class_id', klass.id)
          .limit(5);
        const enrollment = (enrollments || []).find(
          (e: Row) => e.parent_email && e.parent_email_opted_in !== false,
        );
        if (!enrollment) {
          summary.skipped++;
          continue;
        }

        // 4) Don't send twice — skip if a weekly digest already exists for
        // this tutor+student in the last 7 days.
        const { data: existing } = await db
          .from('parent_reports')
          .select('id')
          .eq('tutor_id', tutor.id)
          .eq('student_id', enrollment.student_id)
          .eq('trigger_type', 'weekly_digest')
          .gte('created_at', windowStartIso)
          .limit(1);
        if (existing && existing.length) {
          summary.skipped++;
          continue;
        }

        // 5) Server-to-server invoke generateParentReport (then sendParentReport
        // separately) — same flow as the End Session UX but headless. PDF
        // generation is client-only (React-PDF), so the digest only inserts the
        // parent_reports row + emails the recap WITHOUT a PDF attachment when
        // we run via cron. Tutors can preview/resend with the full PDF from
        // the archive page.
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/generateParentReport`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
              'X-Quest-Internal-Token': INTERNAL_TOKEN,
            },
            body: JSON.stringify({
              class_id: klass.id,
              trigger_type: 'weekly_digest',
              personal_note: null,
              tutor_id: tutor.id,
            }),
          },
        );
        if (!res.ok) {
          summary.errors++;
          console.error(
            `digest gen failed for tutor=${tutor.id} class=${klass.id}: ${res.status}`,
          );
          continue;
        }
        summary.digests_queued++;
      }
    } catch (err) {
      summary.errors++;
      console.error(`digest loop failed for tutor=${tutor.id}:`, err);
    }
  }

  return json(summary, 200);
});
