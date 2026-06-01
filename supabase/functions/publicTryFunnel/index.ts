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

async function generateQuizAndCaseStudy(args: { title: string; transcript: string }) {
  const trimmed = args.transcript.length > 18_000
    ? args.transcript.slice(0, 18_000)
    : args.transcript;

  const prompt = `You are a curriculum designer creating a printable classroom handout based on a YouTube video.

VIDEO TITLE: ${args.title}

VIDEO TRANSCRIPT (may be truncated):
${trimmed}

YOUR TASK:
Produce TWO things, both grounded only in the transcript above:

1. A 10-question multiple-choice quiz. Each question has 4 choices (A–D) and exactly one correct answer. Questions should test comprehension, key facts, and reasoning — not trivia from outside the transcript.

2. A "case study" / discussion scenario. One realistic short scenario (3–6 sentences) that applies the video's central concept to a new situation, followed by 4 open-ended discussion questions a teacher can pose to students.

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

  return { quiz, case_study };
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

    if (action === 'generate') {
      const videoId = String(body.videoId ?? '');
      if (!VIDEO_ID_RE.test(videoId)) return json({ error: 'Invalid videoId' }, 400, req);

      // Fetch metadata + transcript in parallel.
      const [meta, transcript] = await Promise.all([
        videoDetails(videoId),
        fetchTranscript(videoId),
      ]);

      if (!transcript.transcript) {
        return json({ error: 'No transcript available for this video. Try another one with English captions.' }, 422, req);
      }

      const { quiz, case_study } = await generateQuizAndCaseStudy({
        title: meta.title,
        transcript: transcript.transcript,
      });

      if (quiz.length === 0) {
        return json({ error: 'Could not generate quiz questions from this video. Try a video with clearer educational content.' }, 422, req);
      }

      return json({ video: meta, quiz, case_study }, 200, req);
    }

    return json({ error: 'Unknown action' }, 400, req);
  } catch (err) {
    return safeErrorResponse(err, 'Could not process request. Please try a different video.', 500, req);
  }
});
