// Public Socratic-tutor endpoint for anonymous students inside a live session.
//
// Walks the 4-phase Socratic flow from /SocraticInquiry:
//   q1_ack          — Q1 Observation FR acknowledgment (no question)
//   q2_mc_generate  — Q2 Analogy MC (returns JSON: question + 3 choices)
//   q2_ack          — Q2 follow-up after student picks an analogy
//                     (returns: tutor text + bridge question text)
//   q3_mc_generate  — Q3 Bridge MC (returns JSON: 3 choices + correct_index)
//   q3_summary      — Q3 closing summary statement (no question)
//   q4_ack          — Q4 final transfer FR — locks in the lesson
//
// Anonymous students hit this with no JWT, so verify_jwt must be off
// on the function settings. Gating: IP rate-limit + session-code lookup.
//
// Body:
//   {
//     step: 'q1_ack' | 'q2_mc_generate' | 'q2_ack' | 'q3_mc_generate'
//         | 'q3_summary' | 'q4_ack',
//     code: 'EH8Y54',
//     subunitName: 'Newton\'s first law',
//     hookQuestion?: '...',
//     observation?: '...',         // q1_ack
//     tutorQuestion?: '...',       // q2_ack (last tutor question)
//     currentMcQuestion?: '...',   // q2_ack
//     choiceText?: '...',          // q2_ack / q3_summary
//     correctChoice?: '...',       // q2_ack / q3_summary
//     wasCorrect?: boolean,        // q2_ack / q3_summary
//     bridgeQuestion?: '...',      // q3_mc_generate
//     analogyAnswer?: '...',       // q3_summary
//     inquiryHookQuestion?: '...', // q4_ack
//     studentAnswer?: '...'        // q4_ack
//   }
//
// Returns one of:
//   { reply: string }                              // ack/summary steps
//   { question: string, choices: string[],         // mc_generate steps
//     correct_index: number }

import { handlePreflight, json } from '../_shared/cors.ts';
import { adminClient } from '../_shared/client.ts';
import { invokeLLMWithUsage } from '../_shared/llm.ts';
import { clientIp, rateLimitByIp, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

const MODEL = 'gpt-4.1-mini';

type Body = Record<string, unknown>;

// Fisher-Yates shuffle. LLMs strongly bias toward putting the correct answer
// first; without this every MC would have the right answer at A. We shuffle
// server-side and re-map `correct_index` to the new position, so the client
// just renders whatever order it gets.
function shuffleChoices(payload: { choices: string[]; correct_index: number; [k: string]: unknown }) {
  const indices = payload.choices.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const shuffled = indices.map((i) => payload.choices[i]);
  const newCorrect = indices.indexOf(payload.correct_index);
  return { ...payload, choices: shuffled, correct_index: newCorrect };
}

function s(b: Body, k: string): string {
  const v = b?.[k];
  return typeof v === 'string' ? v : '';
}

function buildPrompt(b: Body): { prompt: string; schema?: unknown } {
  const subunit = s(b, 'subunitName') || 'this topic';
  switch (s(b, 'step')) {
    case 'q1_ack':
      return {
        prompt:
          `You are Quest Panda, a warm Socratic tutor. Topic: "${subunit}".\n` +
          `Student's observation of the image: "${s(b, 'observation')}"\n\n` +
          `First decide whether the student actually shared an observation. If their ` +
          `message is off-topic, random/gibberish, blank, or says they're unsure ` +
          `(e.g. "idk", "i don't know", "no idea", "not sure", "?"), do NOT pretend ` +
          `they gave a real observation. Instead, in 1-2 sentences: warmly acknowledge ` +
          `that they're not sure yet, reassure them that's completely okay, and gently ` +
          `invite them to just guess or name anything they notice in the image.\n` +
          `Otherwise, in 1-2 sentences warmly acknowledge what they noticed — pick up ` +
          `on a specific word they used (use **bold**).\n` +
          `Either way, do NOT ask a quiz question. Just respond supportively and say ` +
          `you'll explore this together.`,
      };

    case 'q2_mc_generate':
      return {
        prompt:
          `You are Quest Panda. Topic: "${subunit}".\n\n` +
          `Generate an everyday analogy scenario and ask a multiple choice ` +
          `question that tests the student's understanding of ONLY the analogy ` +
          `itself—not the academic concept yet. Limit it to 1-2 sentences.\n\n` +
          `The question should test comprehension of what happens in the everyday ` +
          `scenario, with 3 randomized plausible options where only one correctly ` +
          `describes the analogy.\n\n` +
          `Return JSON.`,
        schema: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            choices: { type: 'array', items: { type: 'string' } },
            correct_index: { type: 'number' },
          },
          required: ['question', 'choices', 'correct_index'],
        },
      };

    case 'q2_ack':
      return {
        prompt:
          `You are Quest Panda. Topic: "${subunit}".\n` +
          `Student answered the analogy question: "${s(b, 'currentMcQuestion')}"\n` +
          `Their choice: "${s(b, 'choiceText')}" | Correct: "${s(b, 'correctChoice')}" | ` +
          `Was correct: ${b.wasCorrect ? 'true' : 'false'}\n\n` +
          `In 1-2 sentences:\n` +
          `1. If correct, affirm briefly then push deeper. If incorrect, gently ` +
          `redirect without giving the answer away. Use **bold** on a key word ` +
          `from their choice.\n` +
          `2. Explicitly name the connection: explain HOW the everyday analogy ` +
          `maps onto the real concept of "${subunit}" — what plays the role of what.\n` +
          `3. Ask a bridge question that uses this mapping to test whether they ` +
          `can now apply the concept in its academic form. Do NOT list answer ` +
          `choices — they will be shown separately.\n\n` +
          `Return JSON with two fields: "reply" (the 1-2 sentence response that ` +
          `affirms and explains the connection) and "bridgeQuestion" (the ` +
          `bridge question on its own).`,
        schema: {
          type: 'object',
          properties: {
            reply: { type: 'string' },
            bridgeQuestion: { type: 'string' },
          },
          required: ['reply', 'bridgeQuestion'],
        },
      };

    case 'q3_mc_generate':
      return {
        prompt:
          `You are Quest Panda. Topic: "${subunit}".\n` +
          `Bridge question: "${s(b, 'bridgeQuestion')}"\n\n` +
          `Generate 3 randomized MC options that answer the bridge question using ` +
          `the real academic concept of "${subunit}". The correct option must use ` +
          `accurate terminology and directly follow from the analogy-to-concept ` +
          `mapping. Misconceptions should reflect common student errors. Each ` +
          `option under 12 words.\n\n` +
          `Return JSON.`,
        schema: {
          type: 'object',
          properties: {
            choices: { type: 'array', items: { type: 'string' } },
            correct_index: { type: 'number' },
          },
          required: ['choices', 'correct_index'],
        },
      };

    case 'q3_summary':
      return {
        prompt:
          `You are Quest Panda. Topic: "${subunit}".\n` +
          `The student just completed an analogy-to-bridge journey:\n` +
          `- Analogy answer: "${s(b, 'analogyAnswer')}"\n` +
          `- Bridge answer: "${s(b, 'choiceText')}" | Correct: "${s(b, 'correctChoice')}" | ` +
          `Was correct: ${b.wasCorrect ? 'true' : 'false'}\n\n` +
          `Write a 1-2 sentence summary statement (NOT a question) that:\n` +
          `1. Ties together the everyday analogy and the real academic concept of ` +
          `"${subunit}" — make it click.\n` +
          `2. Uses **bold** on the key academic term.\n` +
          `3. Ends with a warm transition like "Now let's put your understanding ` +
          `to the test with one final question."`,
      };

    case 'q4_ack':
      return {
        prompt:
          `You are Quest Panda. Topic: "${subunit}".\n` +
          `The inquiry question was: "${s(b, 'inquiryHookQuestion')}"\n` +
          `Student's answer: "${s(b, 'studentAnswer')}"\n\n` +
          `This is the FINAL exchange. First judge whether the student genuinely ` +
          `engaged with the question. If their answer is off-topic, evasive, ` +
          `gibberish, or says they're unsure (e.g. "idk", "i don't know", "not ` +
          `sure"), do NOT pretend they nailed it. Instead, in 2 sentences: warmly ` +
          `acknowledge that they're unsure and that it's okay, then hand them the ` +
          `one key insight to "${subunit}" yourself in plain terms (use **bold** on ` +
          `the key idea).\n` +
          `If they did engage, in 2 sentences affirm their answer with **bold** on ` +
          `their key insight — be specific.\n` +
          `Either way, end exactly with: "Brilliant thinking! Now let's watch the ` +
          `video to see the full picture." and DO NOT ask another question.`,
      };

    default:
      throw new Error(`Unknown step: ${s(b, 'step')}`);
  }
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 60, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const code = String(body?.code ?? '').trim().toUpperCase();
  if (!code) return json({ error: 'code is required' }, 400);

  // Confirm a live session with this code is open. Stops this from being a
  // free LLM proxy for anyone who knows the function URL.
  const admin = adminClient();
  const { data: sessions, error: sErr } = await admin
    .from('live_sessions')
    .select('id, status')
    .or(`session_code.eq.${code},join_code.eq.${code}`)
    .limit(1);
  if (sErr || !sessions || sessions.length === 0) {
    return json({ error: 'No live session matches that code.' }, 404);
  }
  if (sessions[0].status === 'completed' || sessions[0].status === 'ended') {
    return json({ error: 'This session has already ended.' }, 410);
  }

  try {
    const { prompt, schema } = buildPrompt(body);
    const { content } = await invokeLLMWithUsage({
      prompt,
      model: MODEL,
      response_json_schema: schema as any,
    });

    // mc_generate / q2_ack return parsed JSON; ack/summary steps return a string.
    if (schema) {
      const step = s(body, 'step');
      // Shuffle MC choices so the correct answer isn't always position A.
      if (step === 'q2_mc_generate' || step === 'q3_mc_generate') {
        const shuffled = shuffleChoices(content as any);
        return json(shuffled, 200);
      }
      return json(content, 200);
    }
    const reply = typeof content === 'string' ? content : JSON.stringify(content);
    return json({ reply }, 200);
  } catch (err) {
    console.error('[liveSessionSocratic] failed:', err);
    return json({ error: 'Tutor reply failed.', details: String(err) }, 500);
  }
});
