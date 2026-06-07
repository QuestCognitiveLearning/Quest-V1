// generateSessionPrep — propose a tutoring session plan for a given student.
//
// Inputs:  { student_id, class_id?, target_minutes? }
// Output:  { suggested_plan: [{type, topic, reason, suggested_minutes,
//             suggested_question_count, difficulty}], total_estimated_minutes,
//             context_summary }
//
// Logic:
//   1. Pull last 5 sessions for the student (classes rows where
//      session_ended_at is set, ordered by recency), last 3 parent_reports
//      summaries, and recent quiz_results / case_study_responses / attention
//      checks (last 30 days).
//   2. One gpt-4.1-mini call returns a plan with 1-2 review items (topics
//      where recent accuracy was <75%) and 1-2 new topics from natural
//      progression. Tone: specific, never generic.
//   3. New students with no history get a diagnostic baseline plan.

import { handlePreflight, json, safeErrorResponse } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { adminClient } from '../_shared/client.ts';
import { invokeLLMWithUsage } from '../_shared/llm.ts';
import { guardLLMRequest, logLLMUsage, guardFailureResponse } from '../_shared/llmGuard.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

const MODEL = 'gpt-4.1-mini';
const HISTORY_DAYS = 30;

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 120, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401, req);

  const userLimit = rateLimitByUser(user.id, { maxRequests: 30, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  let body: Row;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, req);
  }
  const studentId = body?.student_id;
  const targetMinutes = Math.max(15, Math.min(120, Number(body?.target_minutes) || 60));
  if (!studentId) return json({ error: 'student_id is required' }, 400, req);

  const guard = await guardLLMRequest({ user, model: MODEL, action: 'light' });
  if (!guard.ok) return guardFailureResponse(guard, {});

  const db = adminClient();

  // Confirm the tutor has a class with this student (cheap ACL check)
  const { data: enrollment } = await db
    .from('student_enrollments')
    .select('class_id, student_full_name')
    .eq('student_id', studentId)
    .limit(50);
  const myClassIds = new Set<string>();
  if (enrollment) {
    const { data: myClasses } = await db
      .from('classes')
      .select('id')
      .eq('teacher_id', user.id);
    for (const c of myClasses || []) myClassIds.add(c.id);
  }
  const hasAccess = (enrollment || []).some((e: Row) => myClassIds.has(e.class_id));
  if (!hasAccess) return json({ error: 'Forbidden' }, 403, req);

  const since = new Date();
  since.setDate(since.getDate() - HISTORY_DAYS);
  const sinceIso = since.toISOString();

  // Pull recent activity
  const [
    { data: pastSessions },
    { data: parentReports },
    { data: quizResults },
    { data: caseResponses },
    { data: attentionResponses },
  ] = await Promise.all([
    db.from('classes')
      .select('id, class_name, session_started_at, session_ended_at, session_topics_covered, session_notes')
      .eq('teacher_id', user.id)
      .not('session_ended_at', 'is', null)
      .order('session_ended_at', { ascending: false })
      .limit(5),
    db.from('parent_reports')
      .select('strengths, areas_to_practice, topics_covered, accuracy_summary, next_session_recommendation, created_at')
      .eq('tutor_id', user.id)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(3),
    db.from('quiz_results')
      .select('subunit_id, total_questions, correct_answers, created_date')
      .eq('student_id', studentId)
      .gte('created_date', sinceIso)
      .order('created_date', { ascending: false })
      .limit(50),
    db.from('case_study_responses')
      .select('subunit_id, created_date')
      .eq('student_id', studentId)
      .gte('created_date', sinceIso)
      .limit(20),
    db.from('attention_check_responses')
      .select('subunit_id, is_correct, created_date')
      .eq('student_id', studentId)
      .gte('created_date', sinceIso)
      .limit(100),
  ]);

  // Build per-topic accuracy
  const subunitIds = new Set<string>();
  for (const r of quizResults || []) if (r.subunit_id) subunitIds.add(r.subunit_id);
  for (const r of caseResponses || []) if (r.subunit_id) subunitIds.add(r.subunit_id);
  for (const r of attentionResponses || []) if (r.subunit_id) subunitIds.add(r.subunit_id);

  const topicMap = new Map<string, string>();
  if (subunitIds.size > 0) {
    const { data: subs } = await db
      .from('subunits')
      .select('id, subunit_name')
      .in('id', [...subunitIds]);
    for (const s of subs || []) topicMap.set(s.id, s.subunit_name);
  }

  // Accuracy per subunit
  type Stat = { topic: string; correct: number; total: number };
  const stats = new Map<string, Stat>();
  for (const r of quizResults || []) {
    if (!r.subunit_id) continue;
    const s = stats.get(r.subunit_id) || {
      topic: topicMap.get(r.subunit_id) || 'topic',
      correct: 0,
      total: 0,
    };
    s.correct += Number(r.correct_answers) || 0;
    s.total += Number(r.total_questions) || 0;
    stats.set(r.subunit_id, s);
  }
  const perTopic = [...stats.values()]
    .filter((s) => s.total > 0)
    .map((s) => ({
      topic: s.topic,
      accuracyPct: Math.round((s.correct / s.total) * 100),
      questions: s.total,
    }))
    .sort((a, b) => b.questions - a.questions);

  const isNewStudent = (quizResults?.length || 0) === 0 && (parentReports?.length || 0) === 0;
  const enrollmentRow = (enrollment || []).find((e: Row) => myClassIds.has(e.class_id));
  const studentName = enrollmentRow?.student_full_name || 'this student';

  // System + user prompt
  const system = `You are preparing a tutoring session plan based on a student's recent work.

Return JSON:
{
  "suggested_plan": [
    {
      "type": "review" | "new",
      "topic": "specific topic name",
      "reason": "1-sentence why",
      "suggested_minutes": 15,
      "suggested_question_count": 5,
      "difficulty": "easy" | "medium" | "hard"
    }
  ],
  "total_estimated_minutes": 60,
  "context_summary": "1-2 sentences"
}

Guidelines:
- 1-2 review items for topics where recent accuracy was below 75%
- 1-2 new topics in natural progression from mastered topics
- Total length close to the requested target (default 60 minutes)
- Struggling topics: easier difficulty, fewer questions, more time
- Mastered topics: harder difficulty, faster pace
- Be specific. Reference actual topics. Never generic.
- For new students with no history: suggest a baseline diagnostic — 2 mixed-difficulty topics, ~5 questions each, no review items.
- No emojis. No jargon.`;

  const promptSections: string[] = [];
  promptSections.push(`Student: ${studentName}`);
  promptSections.push(`Target session length: ${targetMinutes} minutes`);
  if (isNewStudent) {
    promptSections.push(`This student is new — there is no past activity. Suggest a diagnostic baseline.`);
  } else {
    if (perTopic.length) {
      promptSections.push('Recent per-topic accuracy:');
      for (const t of perTopic.slice(0, 10)) {
        promptSections.push(`  - ${t.topic}: ${t.accuracyPct}% over ${t.questions} questions`);
      }
    }
    if (parentReports && parentReports.length) {
      promptSections.push('\nRecent parent reports:');
      for (const r of parentReports) {
        const cov = Array.isArray(r.topics_covered) ? r.topics_covered.join(', ') : '';
        promptSections.push(`  - ${r.created_at?.slice(0, 10) || 'recent'}: topics=${cov}; areas_to_practice=${r.areas_to_practice || ''}; next=${r.next_session_recommendation || ''}`);
      }
    }
    if (pastSessions && pastSessions.length) {
      promptSections.push('\nLast sessions:');
      for (const s of pastSessions) {
        const cov = Array.isArray(s.session_topics_covered) ? s.session_topics_covered.join(', ') : '';
        promptSections.push(`  - ${s.session_ended_at?.slice(0, 10) || 'recent'}: ${cov || '(no recorded topics)'}`);
      }
    }
  }

  let result: Row;
  let usage = { promptTokens: 0, completionTokens: 0 };
  try {
    const r = await invokeLLMWithUsage({
      system,
      prompt: promptSections.join('\n'),
      model: MODEL,
      response_json_schema: {
        type: 'object',
        properties: {
          suggested_plan: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                topic: { type: 'string' },
                reason: { type: 'string' },
                suggested_minutes: { type: 'number' },
                suggested_question_count: { type: 'number' },
                difficulty: { type: 'string' },
              },
            },
          },
          total_estimated_minutes: { type: 'number' },
          context_summary: { type: 'string' },
        },
        required: ['suggested_plan'],
      },
    });
    result = r.content || {};
    usage = r.usage;
  } catch (err) {
    return safeErrorResponse(err, 'Could not generate a session plan.', 500, req);
  }

  await logLLMUsage({
    userId: user.id,
    model: MODEL,
    inputTokens: usage.promptTokens,
    outputTokens: usage.completionTokens,
  });

  // Clamp to sane shape
  const plan = Array.isArray(result.suggested_plan)
    ? result.suggested_plan
        .filter((p: Row) => p && p.topic)
        .slice(0, 6)
        .map((p: Row) => ({
          type: ['review', 'new'].includes(String(p.type)) ? String(p.type) : 'new',
          topic: String(p.topic),
          reason: String(p.reason || ''),
          suggested_minutes: Math.max(5, Math.min(60, Number(p.suggested_minutes) || 15)),
          suggested_question_count: Math.max(
            2,
            Math.min(20, Number(p.suggested_question_count) || 5),
          ),
          difficulty: ['easy', 'medium', 'hard'].includes(String(p.difficulty))
            ? String(p.difficulty)
            : 'medium',
        }))
    : [];

  return json(
    {
      suggested_plan: plan,
      total_estimated_minutes:
        Number(result.total_estimated_minutes) ||
        plan.reduce((n, p) => n + p.suggested_minutes, 0),
      context_summary: String(result.context_summary || ''),
      is_new_student: isNewStudent,
    },
    200,
    req,
  );
});
