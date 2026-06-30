// Generate mid-video attention checks tied to real timestamps.
//
// Approach:
//   1. Number every transcript segment 1..N with its real timestamp.
//   2. Ask the LLM to pick which segments mark the END of an important
//      teaching moment — no fixed cadence, just genuine importance.
//   3. For each pick, the LLM writes a question that can only reference
//      content from segments 1..chosen_index (i.e. what the student has
//      already heard by that point in the video).
//   4. The check's timestamp is the END of the chosen segment, so the
//      student is quizzed AFTER the concept finished being explained.
//
// Guarantees:
//   - Timestamps come from real segments, never fabricated.
//   - The question never references content the student hasn't heard yet.
//   - Number of checks is driven by content importance, not a 60s metronome.

import { handlePreflight, json, safeErrorResponse, corsHeadersFor } from '../_shared/cors.ts';
import { getMe } from '../_shared/auth.ts';
import { invokeLLMWithUsage } from '../_shared/llm.ts';
import { guardLLMRequest, logLLMUsage, guardFailureResponse } from '../_shared/llmGuard.ts';
import { clientIp, rateLimitByIp, rateLimitByUser, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

interface Segment { timestamp: number; text: string }

const MODEL = 'gpt-5-mini';

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const corsH = corsHeadersFor(req);

  // Per-minute throttling complements the daily cap inside llmGuard.
  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 100, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  const user = await getMe(req);
  if (!user) return json({ error: 'Unauthorized' }, 401, req);

  const userLimit = rateLimitByUser(user.id, { maxRequests: 30, windowMs: 60_000 });
  if (!userLimit.allowed) return tooManyRequestsResponse(userLimit);

  // Curriculum-side heavy operation. Same guard stack as invokeLLM.
  const guard = await guardLLMRequest({ user, model: MODEL, action: 'heavy' });
  if (!guard.ok) return guardFailureResponse(guard, corsH);

  const { videoDuration, timestampedSegments } = await req.json();
  if (!videoDuration || videoDuration <= 0) {
    return json({ error: 'videoDuration must be a positive number' }, 400, req);
  }
  if (!Array.isArray(timestampedSegments) || timestampedSegments.length === 0) {
    return json({ error: 'timestampedSegments is required' }, 400, req);
  }

  const segments: Segment[] = timestampedSegments
    .filter((s: Segment) => s && typeof s.timestamp === 'number' && typeof s.text === 'string')
    .sort((a: Segment, b: Segment) => a.timestamp - b.timestamp);

  // Build a numbered, timestamped index the LLM can refer to by integer.
  const segmentEnd = (i: number) =>
    i + 1 < segments.length ? segments[i + 1].timestamp : videoDuration;

  const segmentListing = segments
    .map((seg, i) => {
      const start = formatTime(seg.timestamp);
      const end = formatTime(segmentEnd(i));
      return `[${i + 1}] ${start}–${end}: ${seg.text}`;
    })
    .join('\n');

  const prompt = `You are designing attention-check questions for an educational video.

LANGUAGE REQUIREMENT: All output — every question and every answer choice — MUST be written in English. The transcript below may be in any language; translate the meaning into clear English when you write your questions. Never output any non-English text.

The transcript is numbered by segment below. Each line has the format:
  [N] mm:ss–mm:ss: <verbatim spoken text>

TRANSCRIPT:
${segmentListing}

YOUR TASK:
Select between 2 and ${Math.max(2, Math.min(8, Math.floor(segments.length / 6)))} segments that mark the END of an important teaching moment — a clear point at which a meaningful new concept, fact, or idea has just been FULLY explained.

The check is shown to the student a few seconds AFTER your chosen segment ends, so the answer to your question MUST already be fully stated by the end of that segment — never pick a point before or in the middle of the explanation. The student should have just heard the answer right before the check appears.

DO NOT pick on a fixed cadence (every minute, etc.). Only pick segments where something genuinely important was just taught. If the video is mostly intro/filler/transition, return fewer or zero checks.

For each picked segment, write a 4-choice multiple-choice comprehension question that:
  - Tests understanding of something specifically said in or before that segment.
  - Can be answered using ONLY content from segments 1 through your chosen index. Treat anything in later segments as content the student has not yet heard — never reference it.
  - Has exactly one correct answer, supported directly by the transcript above.
  - Writes each answer choice as a concise phrase WITHOUT a trailing period, unless the choice is a full sentence.

Output JSON in this exact shape:
{
  "checks": [
    {
      "segment_index": <integer in 1..${segments.length}>,
      "question": "...",
      "choice_a": "...",
      "choice_b": "...",
      "choice_c": "...",
      "choice_d": "...",
      "correct_choice": "A" | "B" | "C" | "D"
    }
  ]
}

If nothing important is taught, return {"checks": []}.`;

  let res;
  let usage = { promptTokens: 0, completionTokens: 0 };
  try {
    const result = await invokeLLMWithUsage({
      prompt,
      // High-stakes: questions must not forward-reference future segments,
      // and the timestamp/question contract is brittle. Use gpt-5-mini.
      model: MODEL,
      response_json_schema: {
        type: 'object',
        properties: {
          checks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                segment_index: { type: 'integer' },
                question: { type: 'string' },
                choice_a: { type: 'string' },
                choice_b: { type: 'string' },
                choice_c: { type: 'string' },
                choice_d: { type: 'string' },
                correct_choice: { type: 'string' },
              },
            },
          },
        },
      },
    });
    res = result.content;
    usage = result.usage;
  } catch (err) {
    return safeErrorResponse(err, 'Failed to generate attention checks.', 500, req);
  }

  // Audit-log AFTER success. Failed calls don't count toward the daily cap.
  await logLLMUsage({
    userId: user.id,
    model: MODEL,
    inputTokens: usage.promptTokens,
    outputTokens: usage.completionTokens,
  });

  const raw: Array<Record<string, unknown>> = Array.isArray(res?.checks) ? res.checks : [];

  const checks = raw
    .map((c) => {
      const idx = Number(c.segment_index);
      if (!Number.isInteger(idx) || idx < 1 || idx > segments.length) return null;
      const correct = String(c.correct_choice || '').toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(correct)) return null;
      // Fire a couple seconds AFTER the segment ends (after the answer is
      // spoken) — never before or at the exact second it's mentioned.
      const segmentEndTime = Math.min(videoDuration - 1, Math.round(segmentEnd(idx - 1)) + 2);
      return {
        timestamp: segmentEndTime,
        question: String(c.question || ''),
        choice_a: String(c.choice_a || 'Option A'),
        choice_b: String(c.choice_b || 'Option B'),
        choice_c: String(c.choice_c || 'Option C'),
        choice_d: String(c.choice_d || 'Option D'),
        correct_choice: correct,
        check_order: 0,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null && c.question.length > 5)
    .sort((a, b) => a.timestamp - b.timestamp)
    // Drop near-duplicates that landed within 5s of each other.
    .filter((c, i, arr) => i === 0 || c.timestamp - arr[i - 1].timestamp >= 5)
    .map((c, i) => ({ ...c, check_order: i + 1 }));

  return json({ attention_checks: checks }, 200, req);
});

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
