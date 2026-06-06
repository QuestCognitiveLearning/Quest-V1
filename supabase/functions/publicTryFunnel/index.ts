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

  const difficultyLine = {
    easy: 'Questions should test recall and basic comprehension of explicitly stated facts.',
    medium: 'Questions should test comprehension, application, and light reasoning. Mix recall with inference.',
    hard: 'Questions should test deeper reasoning, application to novel situations, and synthesis across multiple parts of the video.',
  }[difficulty];

  const caseStudyTask = includeCaseStudy
    ? `\n\n2. A "case study" / discussion scenario. One realistic short scenario (3–6 sentences) that applies the video's central concept to a new situation, followed by 4 open-ended discussion questions a teacher can pose to students.`
    : '\n\n(Case study omitted at user request — return case_study with empty scenario and an empty discussion_questions array.)';

  const prompt = `You are a curriculum designer creating a printable classroom handout based on a YouTube video.

VIDEO TITLE: ${args.title}

${audienceLine}

VIDEO TRANSCRIPT (may be truncated):
${trimmed || '(No video transcript supplied. Use the PDF excerpt below as your sole source.)'}
${pdfSection}

YOUR TASK:
Produce ${includeCaseStudy ? 'TWO things' : 'ONE thing'}, both grounded only in the transcript above:

1. A ${count}-question multiple-choice quiz. Each question has 4 choices (A–D) and exactly one correct answer. ${difficultyLine} Do not include trivia from outside the transcript.${caseStudyTask}

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
      };

      let meta: { title: string; channelTitle?: string; thumbnail?: string } = {
        title: topic || 'Uploaded handout',
      };
      let transcriptText = '';

      if (videoId) {
        const [m, transcript] = await Promise.all([
          videoDetails(videoId),
          fetchTranscript(videoId),
        ]);
        meta = m;
        transcriptText = transcript.transcript || '';
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

      return json({ video: meta, quiz, case_study }, 200, req);
    }

    return json({ error: 'Unknown action' }, 400, req);
  } catch (err) {
    return safeErrorResponse(err, 'Could not process request. Please try a different video.', 500, req);
  }
});
