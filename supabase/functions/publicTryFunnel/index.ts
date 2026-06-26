// Anonymous-friendly endpoint that powers the /Try landing-page funnel.
//
// Actions:
//   - search       → YouTube Data API v3 search (long-form only)
//   - videoDetails → snippet + duration for a single videoId
//   - generate     → fetch transcript, then LLM-generate a 10Q quiz + case study
//
// Everything runs without an authenticated user, so per-IP rate limits are
// tightened relative to the signed-in versions (`youtubeSearch`,
// `fetchTranscript`, `generateAttentionChecks`). Costs are LLM/OpenAI dollars
// + YouTube quota, so abuse mitigation matters.
//
// Reuses the same TranscriptAPI + LLM + CORS plumbing as the production
// functions — see `_shared/llm.ts`, `_shared/cors.ts`, `_shared/rateLimit.ts`.

import { handlePreflight, json, safeErrorResponse } from '../_shared/cors.ts';
import { invokeLLMWithUsage } from '../_shared/llm.ts';
import { clientIp, rateLimitByIp, tooManyRequestsResponse } from '../_shared/rateLimit.ts';

const YT_API_KEY = Deno.env.get('YOUTUBE_API_KEY')!;
const TRANSCRIPT_API_KEY = Deno.env.get('TRANSCRIPTAPI_KEY')!;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{6,15}$/;
const MIN_DURATION_SECONDS = 60;
const QUIZ_MODEL = 'gpt-5-mini';

interface Segment { timestamp: number; text: string }

function parseIsoDurationSeconds(iso: string): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? '0', 10) * 3600)
    + (parseInt(m[2] ?? '0', 10) * 60)
    + parseInt(m[3] ?? '0', 10);
}

async function fetchTranscript(videoId: string): Promise<{ transcript: string; segments: Segment[] }> {
  let payload: Record<string, unknown> | null = null;
  let lastError: string | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(
      `https://transcriptapi.com/api/v2/youtube/transcript?video_url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { headers: { Authorization: `Bearer ${TRANSCRIPT_API_KEY}` } },
    );
    if (res.ok) { payload = await res.json(); break; }
    lastError = await res.text();
    if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
  }
  if (!payload) throw new Error(`TranscriptAPI failed: ${lastError ?? 'unknown'}`);

  const captions: Array<{ text?: string; content?: string; start?: number; timestamp?: number }> =
    (payload.transcript as []) ?? (payload.data as []) ?? (Array.isArray(payload) ? payload as [] : []) ?? (payload.captions as []) ?? [];

  const transcript = captions.map((c) => c.text ?? c.content ?? '').join(' ').trim();
  const segments: Segment[] = captions.map((c) => ({
    timestamp: c.start ?? c.timestamp ?? 0,
    text: c.text ?? c.content ?? '',
  }));
  return { transcript, segments };
}

async function videoDetails(videoId: string) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${YT_API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`YouTube videoDetails failed (${r.status})`);
  const data = await r.json();
  const item = data.items?.[0];
  if (!item) throw new Error('Video not found');
  return {
    videoId,
    title: item.snippet?.title ?? '',
    channelTitle: item.snippet?.channelTitle ?? '',
    description: item.snippet?.description ?? '',
    thumbnail: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? '',
    duration: parseIsoDurationSeconds(item.contentDetails?.duration ?? ''),
  };
}

type GenerationOptions = {
  count?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  gradeLevel?: 'Elementary' | 'Middle' | 'High' | 'Undergraduate';
  includeCaseStudy?: boolean;
  includeInquiry?: boolean;
  includeAttentionChecks?: boolean;
};

const GRADE_LABEL: Record<string, string> = {
  Elementary: 'grades 3–5',
  Middle: 'grades 6–8',
  High: 'grades 9–12',
  Undergraduate: 'college freshman level',
};

async function generateQuizAndCaseStudy(
  args: { title: string; transcript: string; pdfText?: string; options?: GenerationOptions },
) {
  // When a PDF is supplied alongside or instead of a transcript, combine
  // both as source material. PDFs typically have richer prose than YT
  // captions, so weight them slightly more in the prompt framing.
  const pdfBudget = 14_000;
  const transcriptBudget = 18_000 - pdfBudget;
  const pdfSlice = (args.pdfText || '').slice(0, pdfBudget);
  const transcriptSlice = (args.transcript || '').slice(0, args.pdfText ? transcriptBudget : 18_000);
  const trimmed = transcriptSlice;
  const pdfSection = pdfSlice
    ? `\n\nSUPPLEMENTAL PDF EXCERPT (use this as primary source if the video transcript is sparse):\n${pdfSlice}`
    : '';

  const count = Math.min(20, Math.max(3, args.options?.count ?? 10));
  const difficulty = args.options?.difficulty ?? 'medium';
  const gradeLabel = args.options?.gradeLevel ? GRADE_LABEL[args.options.gradeLevel] : null;
  const includeCaseStudy = args.options?.includeCaseStudy !== false;

  const audienceLine = gradeLabel
    ? `Target audience: students at ${gradeLabel}. Calibrate vocabulary and complexity accordingly.`
    : 'Target audience: high school students.';

  // Every question is an APPLICATION of what the video teaches, at the video's
  // own depth — never recall/trivia, never material beyond the video. The
  // difficulty knob only shifts where the set is centered; questions still vary
  // just slightly along the application ladder below.
  const difficultyLadder =
    'DIFFICULTY: Every question must APPLY a concept the video actually teaches — never test recall of an isolated fact, date, name, or definition, and never introduce anything the video does not cover. Match the depth at which the video explains each idea (no shallower, no deeper). Vary difficulty only SLIGHTLY across the set, along this ladder:\n' +
    "- easier: apply ONE concept from the video directly to a straightforward case.\n" +
    "- moderate: combine two or more of the video's concepts, or apply one with a small twist.\n" +
    "- harder: apply the video's concepts to a NEW situation not shown in the video (same depth, fresh context).";

  const emphasis = ({
    easy: 'Center the set on the "easier" rung, with a few "moderate" questions for slight variation.',
    medium: 'Spread the questions evenly across the three rungs, centered on "moderate".',
    hard: 'Center the set on the "harder" rung, with a few "moderate" questions for slight variation.',
  } as Record<string, string>)[difficulty] ?? 'Spread the questions evenly across the three rungs.';

  const difficultyLine = `${difficultyLadder}\n${emphasis}`;

  const caseStudyTask = includeCaseStudy
    ? `\n\n2. A "case study" / discussion scenario built ONLY from the concepts in the transcript above. Write ONE realistic short scenario (3–6 sentences) that applies the video's central concept(s) to a NEW situation not shown in the video, at the same depth the video explains them. Every background detail in the scenario must be directly relevant to the topic AND needed to answer the questions — no filler or unrelated facts. Then write 4 open-ended discussion questions that can be answered using the scenario's details and the video's concepts (apply, don't recall).`
    : '\n\n(Case study omitted at user request — return case_study with empty scenario and an empty discussion_questions array.)';

  const prompt = `You are a curriculum designer creating a printable classroom handout based on a YouTube video.

VIDEO TITLE: ${args.title}

${audienceLine}

VIDEO TRANSCRIPT (may be truncated):
${trimmed || '(No video transcript supplied. Use the PDF excerpt below as your sole source.)'}
${pdfSection}

YOUR TASK:
Produce ${includeCaseStudy ? 'TWO things' : 'ONE thing'}, grounded strictly in the video transcript above:

1. A ${count}-question multiple-choice quiz. Each question has 4 choices (A–D) and exactly one correct answer.
STANDALONE: These quiz questions are reviewed weeks or months after the video, so they must STAND ON THEIR OWN. Never refer to "the video", "this video", "the lesson", "the speaker", "as shown/mentioned/discussed", or "earlier". Ask about the concept itself, including any context needed, as if on an exam — not about what the video said.
${difficultyLine}${caseStudyTask}

LANGUAGE: Write all output in clear English regardless of the transcript language.

Output strictly the JSON shape requested.`;

  const result = await invokeLLMWithUsage({
    prompt,
    model: QUIZ_MODEL,
    response_json_schema: {
      type: 'object',
      properties: {
        quiz: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              choice_a: { type: 'string' },
              choice_b: { type: 'string' },
              choice_c: { type: 'string' },
              choice_d: { type: 'string' },
              correct_choice: { type: 'string' },
              explanation: { type: 'string' },
            },
          },
        },
        case_study: {
          type: 'object',
          properties: {
            scenario: { type: 'string' },
            discussion_questions: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  });

  const content = result.content as Record<string, unknown> | null;
  const rawQuiz = Array.isArray(content?.quiz) ? content.quiz : [];
  const quiz = rawQuiz
    .map((q: Record<string, unknown>) => {
      const correct = String(q.correct_choice ?? '').toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(correct)) return null;
      return {
        question: String(q.question ?? ''),
        choice_a: String(q.choice_a ?? ''),
        choice_b: String(q.choice_b ?? ''),
        choice_c: String(q.choice_c ?? ''),
        choice_d: String(q.choice_d ?? ''),
        correct_choice: correct,
        explanation: String(q.explanation ?? ''),
      };
    })
    .filter((q): q is NonNullable<typeof q> => q !== null && q.question.length > 5);

  const cs = (content?.case_study as Record<string, unknown> | undefined) ?? {};
  const discussion = Array.isArray(cs.discussion_questions)
    ? cs.discussion_questions.map((s) => String(s)).filter((s) => s.length > 0)
    : [];
  const case_study = {
    scenario: String(cs.scenario ?? ''),
    discussion_questions: discussion,
  };

  // Inquiry + attention check generation moved client-side to use the
  // curriculum's exact prompts (invokeLLM + generateAttentionChecks Edge
  // Function). publicTryFunnel just returns quiz + case_study so it returns
  // fast and the client fires the heavier inquiry/image/attention paths in
  // parallel.
  return { quiz, case_study };

  // (Dead code below retained while the legacy inline path is decommissioned.)
  // Inquiry session (Socratic hook) — mirrors the prompt used inside
  // ManageCurriculum so the output shape is identical and can be saved
  // to InquirySession entity later if the teacher wants.
  let inquiry_session: {
    hook_question: string;
    hook_image_prompt: string;
    socratic_system_prompt: string;
    tutor_first_message: string;
  } | null = null;
  if (args.options?.includeInquiry) {
    try {
      const inqPrompt = `You are the world's best automated inquiry-based learning designer.

LANGUAGE: All generated text must be in clear, natural English. Translate non-English source material; never output non-English text.

Topic: "${args.title}"

Create a curiosity hook for this topic. IMPORTANT: The student has NOT learned this concept yet — they are encountering it for the first time. The hook question should relate directly to the topic but be answerable through intuition, prior knowledge, or everyday experience.

The hook_image_prompt should describe a real-world application or example of the topic (not an analogy). Show what this concept looks like in real life.

Return strict JSON:
{
  "hook_image_prompt": "[Describe the real-world application of the topic]. Style: cartoon-realistic with simplified forms and accurate physics, minimal and sleek, muted neutral and soft pastel color palette with low saturation (not vibrant), clean thin outlines, modern educational illustration, pure white background only, single clear centered scenario in ONE UNIFIED SCENE, keep it simple and easy to understand, no people, no hands, no text, no labels, no arrows, no symbols, no numbers, no multiple panels or stages, calm polished classroom aesthetic, 1792x1024.",
  "hook_question": "Question (8-18 words) directly about the topic that students can answer through intuition or everyday experience, even without formal knowledge.",
  "socratic_system_prompt": "You are Panda, a Socratic tutor. The student has NOT learned this topic yet. Guide them to think about it using their intuition and prior knowledge. Ask questions, never explain. Max 3 exchanges. Stay on topic. End with: 'Brilliant thinking! Now watch the video.'",
  "tutor_first_message": "Warm response to student's guess, with follow-up question that helps them explore the topic further."
}`;
      const inqResult = await invokeLLMWithUsage({
        prompt: inqPrompt,
        model: QUIZ_MODEL,
        response_json_schema: {
          type: 'object',
          properties: {
            hook_image_prompt: { type: 'string' },
            hook_question: { type: 'string' },
            socratic_system_prompt: { type: 'string' },
            tutor_first_message: { type: 'string' },
          },
        },
      });
      const ic = inqResult.content as Record<string, unknown> | null;
      if (ic && typeof ic.hook_question === 'string') {
        inquiry_session = {
          hook_image_prompt: String(ic.hook_image_prompt || ''),
          hook_question: String(ic.hook_question || ''),
          socratic_system_prompt: String(ic.socratic_system_prompt || ''),
          tutor_first_message: String(ic.tutor_first_message || ''),
        };
      }
    } catch (err) {
      console.error('[publicTryFunnel] inquiry generation failed:', err);
    }
  }

  // Attention checks (mid-video MCQ at specific timestamps). Only meaningful
  // when there's a video transcript — PDF-only sources skip.
  let attention_checks: Array<{
    timestamp: number;
    question: string;
    choice_a: string;
    choice_b: string;
    choice_c: string;
    choice_d: string;
    correct_choice: string;
    explanation: string;
  }> = [];
  if (args.options?.includeAttentionChecks && args.transcript && args.transcript.length > 200) {
    try {
      const acPrompt = `You design "attention checks" — short multiple-choice questions embedded inside a video to keep students focused. Pick 3 strategic timestamps spaced roughly evenly through the video where a key concept is introduced or a transition happens. At each timestamp, write a 1-question MCQ about what was JUST covered.

CRITICAL LANGUAGE RULE: Every word of your output — questions, all four choices, and explanations — MUST be in clear, natural English. If the video transcript is in another language, translate the concepts into English before writing the questions. NEVER copy non-English phrases. NEVER output non-English text. The choices should each be plausible distractors with one clearly correct answer.

${audienceLine}

VIDEO TITLE: ${args.title}
VIDEO TRANSCRIPT (may be truncated):
${trimmed}

Return strict JSON only. timestamps are integers (seconds from 0). correct_choice is the single letter A/B/C/D.`;
      const acResult = await invokeLLMWithUsage({
        prompt: acPrompt,
        model: QUIZ_MODEL,
        response_json_schema: {
          type: 'object',
          properties: {
            attention_checks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  timestamp: { type: 'integer' },
                  question: { type: 'string' },
                  choice_a: { type: 'string' },
                  choice_b: { type: 'string' },
                  choice_c: { type: 'string' },
                  choice_d: { type: 'string' },
                  correct_choice: { type: 'string' },
                  explanation: { type: 'string' },
                },
              },
            },
          },
        },
      });
      const ac = acResult.content as Record<string, unknown> | null;
      const list = Array.isArray(ac?.attention_checks) ? ac!.attention_checks : [];
      attention_checks = list
        .map((c: Record<string, unknown>) => {
          const correct = String(c.correct_choice ?? '').toUpperCase();
          if (!['A', 'B', 'C', 'D'].includes(correct)) return null;
          return {
            timestamp: Math.max(0, Number(c.timestamp) || 0),
            question: String(c.question ?? ''),
            choice_a: String(c.choice_a ?? ''),
            choice_b: String(c.choice_b ?? ''),
            choice_c: String(c.choice_c ?? ''),
            choice_d: String(c.choice_d ?? ''),
            correct_choice: correct,
            explanation: String(c.explanation ?? ''),
          };
        })
        .filter((c) => c !== null);
    } catch (err) {
      console.error('[publicTryFunnel] attention check generation failed:', err);
    }
  }

  return { quiz, case_study, inquiry_session, attention_checks };
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Strict per-IP cap. Anonymous endpoint with LLM + YouTube quota cost.
  const ipLimit = rateLimitByIp(clientIp(req), { maxRequests: 20, windowMs: 60_000 });
  if (!ipLimit.allowed) return tooManyRequestsResponse(ipLimit);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, req);
  }

  const action = String(body.action ?? '');

  try {
    if (action === 'search') {
      const query = String(body.query ?? '').trim().slice(0, 200);
      if (!query) return json({ error: 'query is required' }, 400, req);

      const base = 'https://www.googleapis.com/youtube/v3';
      const searchUrl = `${base}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=15&key=${YT_API_KEY}`;
      const sr = await fetch(searchUrl);
      if (!sr.ok) return json(await sr.json(), sr.status, req);
      const searchPayload = await sr.json();
      const items: Array<{ id: { videoId: string }; snippet: Record<string, unknown> }> = searchPayload.items ?? [];
      if (items.length === 0) return json({ items: [] }, 200, req);

      const ids = items
        .map((it) => it.id?.videoId)
        .filter((id): id is string => typeof id === 'string' && VIDEO_ID_RE.test(id));
      if (ids.length === 0) return json({ items: [] }, 200, req);

      const detailsUrl = `${base}/videos?part=contentDetails&id=${ids.join(',')}&key=${YT_API_KEY}`;
      const dr = await fetch(detailsUrl);
      const durationByVideoId = new Map<string, number>();
      if (dr.ok) {
        const detailsPayload = await dr.json();
        for (const v of (detailsPayload.items as Array<{ id: string; contentDetails: { duration: string } }>) ?? []) {
          durationByVideoId.set(v.id, parseIsoDurationSeconds(v.contentDetails?.duration ?? ''));
        }
      }

      const filtered = items
        .filter((it) => (durationByVideoId.get(it.id?.videoId ?? '') ?? 0) > MIN_DURATION_SECONDS)
        .slice(0, 6)
        .map((it) => {
          const sn = it.snippet as Record<string, unknown>;
          const thumbs = sn.thumbnails as Record<string, { url: string }> | undefined;
          return {
            videoId: it.id.videoId,
            title: String(sn.title ?? ''),
            channelTitle: String(sn.channelTitle ?? ''),
            thumbnail: thumbs?.high?.url ?? thumbs?.medium?.url ?? '',
            duration: durationByVideoId.get(it.id.videoId) ?? 0,
          };
        });

      return json({ items: filtered }, 200, req);
    }

    if (action === 'videoDetails') {
      const videoId = String(body.videoId ?? '');
      if (!VIDEO_ID_RE.test(videoId)) return json({ error: 'Invalid videoId' }, 400, req);
      const details = await videoDetails(videoId);
      return json(details, 200, req);
    }

    // Quest Panda mid-session chat for students NOT logged in (logged-in
    // students go through the authed invokeLLM path). Per-IP rate limited above;
    // the client also caps the number of messages per session.
    if (action === 'panda') {
      const prompt = String(body.prompt ?? '').slice(0, 6000);
      if (!prompt) return json({ error: 'prompt is required' }, 400, req);
      const result = await invokeLLMWithUsage({ prompt, model: QUIZ_MODEL });
      const text = typeof result?.content === 'string'
        ? result.content
        : String(result?.content ?? '');
      return json({ text }, 200, req);
    }

    if (action === 'generate') {
      // PDF text can supplement OR replace a video. videoId is now optional
      // when pdfText + topic are present.
      const videoId = body.videoId ? String(body.videoId) : '';
      const pdfText = body.pdfText ? String(body.pdfText).slice(0, 200_000) : '';
      const topic = body.topic ? String(body.topic).slice(0, 200) : '';
      if (videoId && !VIDEO_ID_RE.test(videoId)) return json({ error: 'Invalid videoId' }, 400, req);
      if (!videoId && !pdfText) {
        return json({ error: 'Provide a videoId or pdfText' }, 400, req);
      }

      // Defensive: caller's customize panel ships these as a nested object.
      const rawOpts = (body as Record<string, unknown>).options as Record<string, unknown> | undefined;
      const options: GenerationOptions = {
        count: typeof rawOpts?.count === 'number' ? rawOpts.count : undefined,
        difficulty: ['easy', 'medium', 'hard'].includes(String(rawOpts?.difficulty))
          ? (rawOpts!.difficulty as 'easy' | 'medium' | 'hard')
          : undefined,
        gradeLevel: ['Elementary', 'Middle', 'High', 'Undergraduate'].includes(
          String(rawOpts?.gradeLevel),
        )
          ? (rawOpts!.gradeLevel as GenerationOptions['gradeLevel'])
          : undefined,
        includeCaseStudy: rawOpts?.includeCaseStudy === false ? false : true,
        includeInquiry: rawOpts?.includeInquiry === true,
        includeAttentionChecks: rawOpts?.includeAttentionChecks === true,
      };

      let meta: { title: string; channelTitle?: string; thumbnail?: string; duration?: number; videoId?: string } = {
        title: topic || 'Uploaded handout',
      };
      let transcriptText = '';
      let timestampedSegments: Array<{ timestamp: number; text: string }> = [];

      if (videoId) {
        const [m, transcript] = await Promise.all([
          videoDetails(videoId),
          fetchTranscript(videoId),
        ]);
        meta = m;
        transcriptText = transcript.transcript || '';
        timestampedSegments = Array.isArray(transcript.segments) ? transcript.segments : [];
        if (!transcriptText && !pdfText) {
          return json({ error: 'No transcript available for this video. Try another video with English captions or upload a PDF.' }, 422, req);
        }
      }

      const { quiz, case_study } = await generateQuizAndCaseStudy({
        title: meta.title,
        transcript: transcriptText,
        pdfText,
        options,
      });

      if (quiz.length === 0) {
        return json({ error: 'Could not generate questions from this source. Try a different video or PDF.' }, 422, req);
      }

      // Hand back the raw transcript + segments so the client can fire
      // inquiry / image / attention check generation using the existing
      // curriculum code paths (invokeLLM, generateImage, generateAttentionChecks).
      return json({
        video: meta,
        quiz,
        case_study,
        transcript: transcriptText,
        timestamped_segments: timestampedSegments,
        video_duration: meta.duration || 0,
      }, 200, req);
    }

    return json({ error: 'Unknown action' }, 400, req);
  } catch (err) {
    return safeErrorResponse(err, 'Could not process request. Please try a different video.', 500, req);
  }
});
