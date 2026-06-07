// scoreCaseStudyAnswer — grades a student's free-response answer to a case-
// study prompt on a 4-point rubric. Returns score + brief feedback so the
// teacher/student see why. Used by the live session flow: student submits
// → function scores → live_session_responses row gets points_earned +
// ai_score + ai_feedback.
//
// Auth: student JWT (must be authenticated to play). Validates that the
// caller is a participant of the live session before scoring.

import { handlePreflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/client.ts';
import { getMe } from '../_shared/auth.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';
import { validate } from '../_shared/validator.ts';
import { invokeLLMWithUsage } from '../_shared/llm.ts';

const RUBRIC = `
4 — EXEMPLARY: insightful analysis, uses concrete evidence from the scenario, clear and complete reasoning chain.
3 — PROFICIENT: clear answer with supporting reasoning; minor gaps in evidence use.
2 — DEVELOPING: partial answer or evidence; reasoning is incomplete or unclear.
1 — EMERGING: off-topic, brief, or unsupported.
0 — NO ATTEMPT: blank, gibberish, or refusal.`;

const POINTS_PER_SCORE: Record<number, number> = {
  4: 100,
  3: 75,
  2: 50,
  1: 25,
  0: 0,
};

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 60, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const userLimit = rateLimitByUser(user.id, { maxRequests: 30, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  const { ok, value, errors } = validate(await req.json(), {
    liveSessionId:    { type: 'string', required: true, maxLength: 100 },
    questionIndex:    { type: 'integer', required: true, min: 0, max: 20 },
    scenario:         { type: 'string', required: true, maxLength: 4000 },
    prompt:           { type: 'string', required: true, maxLength: 2000 },
    modelAnswer:      { type: 'string', required: false, maxLength: 4000 },
    studentAnswer:    { type: 'string', required: true, maxLength: 8000 },
  });
  if (!ok) return json({ error: 'Invalid request', details: errors }, 400);

  const admin = adminClient();

  // Verify the user is actually a participant of this session before we
  // spend OpenAI tokens on them.
  const { data: participant } = await admin
    .from('live_session_participants')
    .select('id')
    .eq('live_session_id', value.liveSessionId)
    .eq('student_id', user.id)
    .maybeSingle();
  if (!participant) {
    return json({ error: 'Not a participant of this session' }, 403);
  }

  const promptText = `You are scoring a student's free-response answer to a case-study question.

SCENARIO:
${value.scenario}

PROMPT:
${value.prompt}

${value.modelAnswer ? `MODEL ANSWER (for your reference, not shown to the student):\n${value.modelAnswer}\n` : ''}

STUDENT ANSWER:
${value.studentAnswer}

RUBRIC:
${RUBRIC}

Score the student's answer on the 0-4 rubric. Be fair — students at the high-school / undergraduate level are not expected to write a model answer verbatim. Award full credit when the reasoning is sound even if phrasing differs.

Return JSON only.`;

  let score = 0;
  let feedback = '';
  try {
    const result = await invokeLLMWithUsage({
      prompt: promptText,
      response_json_schema: {
        type: 'object',
        properties: {
          score: { type: 'integer', minimum: 0, maximum: 4 },
          feedback: { type: 'string' },
        },
        required: ['score', 'feedback'],
      },
    });
    const content = result.content as { score?: number; feedback?: string } | null;
    score = Math.max(0, Math.min(4, Number(content?.score ?? 0)));
    feedback = String(content?.feedback || '').slice(0, 600);
  } catch (err) {
    console.error('[scoreCaseStudyAnswer] LLM call failed:', err);
    return json({ error: 'Could not score answer right now' }, 502);
  }

  const points = POINTS_PER_SCORE[score] ?? 0;

  // Persist the response.
  const { error: insertErr } = await admin
    .from('live_session_responses')
    .insert({
      live_session_id: value.liveSessionId,
      student_id: user.id,
      question_index: value.questionIndex,
      question_type: 'case_study',
      response: value.studentAnswer,
      ai_score: score,
      ai_feedback: feedback,
      points_earned: points,
      max_points: 100,
      submitted_at: new Date().toISOString(),
    });
  if (insertErr) {
    console.error('[scoreCaseStudyAnswer] insert failed:', insertErr);
  } else {
    // Increment participant total.
    await admin.rpc('increment_participant_points', {
      p_session_id: value.liveSessionId,
      p_student_id: user.id,
      p_points: points,
    }).catch(async () => {
      // No RPC yet — fall back to manual update.
      const { data: cur } = await admin
        .from('live_session_participants')
        .select('total_points')
        .eq('live_session_id', value.liveSessionId)
        .eq('student_id', user.id)
        .maybeSingle();
      await admin
        .from('live_session_participants')
        .update({ total_points: (cur?.total_points || 0) + points })
        .eq('live_session_id', value.liveSessionId)
        .eq('student_id', user.id);
    });
  }

  return json({ ok: true, score, points, feedback });
});
