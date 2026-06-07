// generateParentReport — Studio tier parent progress report generator.
//
// Inputs:  { class_id, trigger_type, personal_note? }
// Outputs: { report_id, report: {...}, branding: {...}, student: {...}, parent_emails: [] }
//
// What it does:
//   1. Authenticates the caller and confirms they own the class.
//   2. Pulls the class + first enrollment (the student), the tutor's branding,
//      and a 7-day window of quiz / case-study / attention-check activity.
//   3. ONE OpenAI call (gpt-4.1-mini) to summarize the activity into the
//      strengths / areas / 3 parent questions / next-session recommendation
//      shape parents see in the PDF and email.
//   4. Inserts a parent_reports row capturing all of the above.
//   5. Returns the row + the data the client needs to render the PDF and
//      invoke the email send (PDF rendering uses @react-pdf/renderer which is
//      client-only, so the upload + Resend send happens client-side).
//
// Why split client/server here:
//   - OpenAI key has to stay server-side.
//   - PDF rendering uses React-PDF (client-only).
//   - Resend send is cheap; doing it client-side keeps the function focused.

import { handlePreflight, json, safeErrorResponse } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { adminClient } from '../_shared/client.ts';
import { invokeLLMWithUsage } from '../_shared/llm.ts';
import { guardLLMRequest, logLLMUsage, guardFailureResponse } from '../_shared/llmGuard.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

const MODEL = 'gpt-4.1-mini';
const WINDOW_DAYS = 7;

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 60, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401, req);

  const userLimit = rateLimitByUser(user.id, { maxRequests: 12, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  // Studio tier gate: branding/parent-reports capability is on `tier`. The
  // legacy `subscription_tier` is allowed too while migration finishes.
  const tier = user.tier || (user.subscription_tier === 'premium' ? 'classroom' : 'free');
  if (!['studio', 'enterprise'].includes(tier)) {
    return json({ error: 'Parent reports require Studio tier' }, 403, req);
  }

  let body: Row;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, req);
  }

  const { class_id, trigger_type, personal_note } = body || {};
  if (!class_id) return json({ error: 'class_id is required' }, 400, req);
  if (!['session_end', 'weekly_digest', 'manual'].includes(trigger_type)) {
    return json({ error: 'trigger_type must be session_end | weekly_digest | manual' }, 400, req);
  }

  const guard = await guardLLMRequest({ user, model: MODEL, action: 'light' });
  if (!guard.ok) return guardFailureResponse(guard, {});

  const db = adminClient();

  // 1) Class + ownership check
  const { data: klass, error: kErr } = await db
    .from('classes')
    .select('*')
    .eq('id', class_id)
    .maybeSingle();
  if (kErr || !klass) return json({ error: 'Class not found' }, 404, req);
  if (klass.teacher_id !== user.id) return json({ error: 'Forbidden' }, 403, req);

  // 2) First enrollment = the student (tutors have 1-student "sessions")
  const { data: enrollments } = await db
    .from('student_enrollments')
    .select('*')
    .eq('class_id', class_id)
    .limit(5);
  const enrollment = (enrollments || [])[0];
  if (!enrollment) return json({ error: 'No student enrolled in this session' }, 400, req);

  // 3) Student row (for full_name)
  const { data: studentRow } = await db
    .from('users')
    .select('id, full_name, email')
    .eq('id', enrollment.student_id)
    .maybeSingle();
  const studentName =
    enrollment.student_full_name || studentRow?.full_name || 'Your student';

  // 4) Branding
  const { data: branding } = await db
    .from('branding')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  // 5) Date window — for session_end use the session bounds; otherwise last 7d.
  const rangeEnd = new Date();
  const rangeStart = new Date();
  if (trigger_type === 'session_end' && klass.session_started_at) {
    rangeStart.setTime(new Date(klass.session_started_at).getTime());
    if (klass.session_ended_at) {
      rangeEnd.setTime(new Date(klass.session_ended_at).getTime());
    }
  } else {
    rangeStart.setDate(rangeEnd.getDate() - WINDOW_DAYS);
  }
  // Expand by 5min on each side to avoid timing-edge data loss
  rangeStart.setMinutes(rangeStart.getMinutes() - 5);
  rangeEnd.setMinutes(rangeEnd.getMinutes() + 5);

  // 6) Activity in the window
  const studentId = enrollment.student_id;

  const [quizRes, csRes, acRes, inqRes] = await Promise.all([
    db.from('quiz_results')
      .select('*')
      .eq('student_id', studentId)
      .gte('created_date', rangeStart.toISOString())
      .lte('created_date', rangeEnd.toISOString())
      .limit(200),
    db.from('case_study_responses')
      .select('*')
      .eq('student_id', studentId)
      .gte('created_date', rangeStart.toISOString())
      .lte('created_date', rangeEnd.toISOString())
      .limit(50),
    db.from('attention_check_responses')
      .select('*')
      .eq('student_id', studentId)
      .gte('created_date', rangeStart.toISOString())
      .lte('created_date', rangeEnd.toISOString())
      .limit(200),
    db.from('inquiry_sessions')
      .select('*')
      .eq('student_id', studentId)
      .gte('created_date', rangeStart.toISOString())
      .lte('created_date', rangeEnd.toISOString())
      .limit(50),
  ]);

  const quizResults = quizRes.data || [];
  const csResponses = csRes.data || [];
  const acResponses = acRes.data || [];
  const inqSessions = inqRes.data || [];

  // 7) Topic mapping — join through the subunits the activity touched
  const subunitIds = new Set<string>();
  for (const r of quizResults) if (r.subunit_id) subunitIds.add(r.subunit_id);
  for (const r of csResponses) if (r.subunit_id) subunitIds.add(r.subunit_id);
  for (const r of acResponses) if (r.subunit_id) subunitIds.add(r.subunit_id);
  for (const r of inqSessions) if (r.subunit_id) subunitIds.add(r.subunit_id);

  let topicMap = new Map<string, string>();
  if (subunitIds.size > 0) {
    const { data: subs } = await db
      .from('subunits')
      .select('id, subunit_name')
      .in('id', [...subunitIds]);
    for (const s of subs || []) topicMap.set(s.id, s.subunit_name);
  }
  const topicsCovered = [...new Set([...topicMap.values()])].slice(0, 12);

  // 8) Accuracy summary
  const totalQ = quizResults.reduce((n, r) => n + (Number(r.total_questions) || 0), 0);
  const correctQ = quizResults.reduce((n, r) => n + (Number(r.correct_answers) || 0), 0);
  const accuracyPct = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : null;
  const acCorrect = acResponses.filter((r) => r.is_correct).length;
  const acTotal = acResponses.length;
  const accuracySummary = {
    quizzes: quizResults.length,
    quiz_questions_total: totalQ,
    quiz_questions_correct: correctQ,
    accuracyPct,
    attention_checks_total: acTotal,
    attention_checks_correct: acCorrect,
    case_studies: csResponses.length,
    inquiry_sessions: inqSessions.length,
    timeOnTaskMin:
      trigger_type === 'session_end' && klass.session_started_at && klass.session_ended_at
        ? Math.max(
            1,
            Math.round(
              (new Date(klass.session_ended_at).getTime() -
                new Date(klass.session_started_at).getTime()) /
                60000,
            ),
          )
        : null,
  };

  // 9) Build the prompt
  const activityLines: string[] = [];
  for (const r of quizResults.slice(0, 30)) {
    activityLines.push(
      `- Quiz on "${topicMap.get(r.subunit_id) || 'topic'}": ${r.correct_answers}/${r.total_questions} correct`,
    );
  }
  for (const r of csResponses.slice(0, 15)) {
    activityLines.push(`- Case study on "${topicMap.get(r.subunit_id) || 'topic'}"`);
  }
  for (const r of acResponses.slice(0, 30)) {
    activityLines.push(
      `- Attention check on "${topicMap.get(r.subunit_id) || 'topic'}": ${r.is_correct ? 'correct' : 'missed'}`,
    );
  }

  const tutorNotesText =
    Array.isArray(klass.session_notes)
      ? klass.session_notes
          .filter((n: Row) => n?.kind === 'final' || n?.kind === 'draft')
          .map((n: Row) => n.text)
          .filter(Boolean)
          .join('\n---\n')
      : '';

  const system = `You are summarizing a tutoring session for a parent. Write 3 sections based on the data provided.

STRENGTHS (2-3 sentences): Specific things the student did well. Reference actual topics. Never generic.
AREAS_TO_PRACTICE (2-3 sentences): Specific topics they struggled with. Constructive, never harsh.
QUESTIONS_FOR_PARENT (exactly 3): Open-ended conversational questions a parent can ask their child this week. Age-appropriate.
NEXT_SESSION_RECOMMENDATION (1-2 sentences): What to cover next based on this session.

Return JSON:
{
  "strengths": "...",
  "areas_to_practice": "...",
  "questions_for_parent": ["...", "...", "..."],
  "next_session_recommendation": "..."
}

Tone: warm, professional, specific. First-person as the tutor. No jargon. No emojis.`;

  const userPrompt = `Student: ${studentName}
Tutor: ${branding?.tutor_name || user.full_name || 'the tutor'}
Date range: ${rangeStart.toISOString().slice(0, 10)} → ${rangeEnd.toISOString().slice(0, 10)}
Topics covered: ${topicsCovered.length ? topicsCovered.join(', ') : 'none recorded'}
Accuracy: ${accuracyPct != null ? accuracyPct + '%' : 'no quiz data'} on ${totalQ} quiz questions
Attention checks: ${acCorrect}/${acTotal} correct
Case studies completed: ${csResponses.length}
Inquiry sessions completed: ${inqSessions.length}

Activity log:
${activityLines.length ? activityLines.join('\n') : '(no logged activity in window)'}

${tutorNotesText ? `Tutor's own session notes:\n${tutorNotesText}` : ''}
${personal_note ? `Tutor's personal note for the parent: ${personal_note}` : ''}`;

  let summary: Row;
  let usage = { promptTokens: 0, completionTokens: 0 };
  try {
    const r = await invokeLLMWithUsage({
      system,
      prompt: userPrompt,
      model: MODEL,
      response_json_schema: {
        type: 'object',
        properties: {
          strengths: { type: 'string' },
          areas_to_practice: { type: 'string' },
          questions_for_parent: { type: 'array', items: { type: 'string' } },
          next_session_recommendation: { type: 'string' },
        },
        required: ['strengths', 'areas_to_practice', 'questions_for_parent'],
      },
    });
    summary = r.content || {};
    usage = r.usage;
  } catch (err) {
    return safeErrorResponse(err, 'Could not summarize the session.', 500, req);
  }

  await logLLMUsage({
    userId: user.id,
    model: MODEL,
    inputTokens: usage.promptTokens,
    outputTokens: usage.completionTokens,
  });

  const questionsForParent = Array.isArray(summary.questions_for_parent)
    ? summary.questions_for_parent.slice(0, 3)
    : [];

  // 10) Insert the row
  const { data: report, error: insErr } = await db
    .from('parent_reports')
    .insert({
      tutor_id: user.id,
      student_id: studentId,
      class_id,
      trigger_type,
      date_range_start: rangeStart.toISOString(),
      date_range_end: rangeEnd.toISOString(),
      topics_covered: topicsCovered,
      accuracy_summary: accuracySummary,
      strengths: summary.strengths || null,
      areas_to_practice: summary.areas_to_practice || null,
      tutor_notes: tutorNotesText || null,
      tutor_personal_note: personal_note || null,
      questions_for_parent: questionsForParent,
      next_session_recommendation: summary.next_session_recommendation || null,
    })
    .select()
    .single();
  if (insErr || !report) {
    return safeErrorResponse(insErr, 'Could not save the report.', 500, req);
  }

  const parentEmails = [enrollment.parent_email, enrollment.parent_email_secondary]
    .filter(Boolean);

  return json(
    {
      report_id: report.id,
      report,
      branding: branding || null,
      student: { id: studentId, full_name: studentName },
      tutor: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
      },
      parent_emails: parentEmails,
      parent_name: enrollment.parent_name || null,
    },
    200,
    req,
  );
});
