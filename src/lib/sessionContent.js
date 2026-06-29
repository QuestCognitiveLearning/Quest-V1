/**
 * sessionContent — maps a generated lesson-bundle payload into the normalized
 * `content` object the shared SessionFlow engine consumes. Used by assigned
 * sessions and live sessions (and anywhere else a bundle payload is played).
 */
import { dqText, dqAnswer } from "@/lib/caseStudy";

const LETTER_TO_INDEX = { A: 0, B: 1, C: 2, D: 3 };

export function getYouTubeVideoId(url) {
  if (!url) return null;
  if (url.includes("youtube.com/watch?v=")) return url.split("watch?v=")[1]?.split("&")[0];
  if (url.includes("youtu.be/")) return url.split("youtu.be/")[1]?.split("?")[0];
  if (url.includes("youtube.com/embed/")) return url.split("embed/")[1]?.split("?")[0];
  return null;
}

// Build a 4-part case study CaseStudyChat can run. The generator returns
// { scenario, discussion_questions[] }, so map those into the a–d slots; honor
// explicit question_a..d / answer_a..d if a richer generator added them.
export function toCaseStudy(cs) {
  if (!cs?.scenario) return null;
  const dq = Array.isArray(cs.discussion_questions) ? cs.discussion_questions : [];
  const pick = (L, idx) => cs[`question_${L}`] || dqText(dq[idx]) || "";
  const pickAns = (L, idx) => cs[`answer_${L}`] || dqAnswer(dq[idx]) || "";
  const qa = pick("a", 0), qb = pick("b", 1), qc = pick("c", 2), qd = pick("d", 3);
  if (!qa && !qb && !qc && !qd) return null;
  return {
    scenario: cs.scenario,
    question_a: qa, question_b: qb, question_c: qc, question_d: qd,
    answer_a: pickAns("a", 0), answer_b: pickAns("b", 1), answer_c: pickAns("c", 2), answer_d: pickAns("d", 3),
  };
}

// Shuffle the 4 options of a quiz question and remap the correct index.
export function toQuizQuestion(q, i) {
  const raw = [q.choice_a, q.choice_b, q.choice_c, q.choice_d];
  const correctIdx = LETTER_TO_INDEX[String(q.correct_choice || "A").toUpperCase()] ?? 0;
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const options = order.map((idx) => raw[idx]).filter((v) => v != null);
  const newCorrect = order.indexOf(correctIdx);
  return {
    id: q.id || `q${i}`,
    question: q.question || q.question_text || "",
    options,
    correctIndex: Math.max(0, newCorrect),
    explanation: q.explanation || "",
  };
}

// Map a generated lesson-bundle payload → SessionFlow's normalized `content`.
export function bundlePayloadToContent(payload, { badgeLabel = "Assigned", sourceUrl = "", title = "" } = {}) {
  const p = payload || {};
  const video = p.video || {};
  const videoId =
    video.videoId ||
    getYouTubeVideoId(video.video_url) ||
    getYouTubeVideoId(video.url) ||
    getYouTubeVideoId(sourceUrl) ||
    null;
  return {
    // Prefer the teacher-given session title; fall back to the video title.
    topic: title || video.title || p.title || "Learning session",
    unitName: "",
    badgeLabel,
    videoId,
    videoDurationSeconds: p.video_duration || video.duration || video.duration_seconds,
    attentionChecks: Array.isArray(p.attention_checks) ? p.attention_checks : [],
    questions: Array.isArray(p.quiz) ? p.quiz.map(toQuizQuestion) : [],
    caseStudy: toCaseStudy(p.case_study),
    inquiry: p.inquiry_session?.hook_question
      ? { hook_question: p.inquiry_session.hook_question, hook_image_url: p.inquiry_session.hook_image_url }
      : null,
  };
}
