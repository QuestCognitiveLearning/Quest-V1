/**
 * SelfSessionPhases — adapter that plays a generated bundle payload through the
 * shared SessionFlow engine, so a single session has the EXACT same design,
 * steps, and flow as a curriculum learn session (inquiry → video + attention
 * checks → quiz → case study → results + review).
 *
 * It maps the JSONB `payload` into SessionFlow's normalized `content`, collects
 * per-question responses + scores as the student plays, and hands a completion
 * payload back to the parent for persistence.
 *
 * Props:
 *   payload      – the lesson bundle payload (video, quiz, case_study, inquiry_session, attention_checks)
 *   onComplete(p)– fired when the student finishes; p has quiz/case scores + responses
 *   onFinish(p)  – optional; fired alongside onComplete (parent navigates/persists)
 *   onExit()     – optional; fired when the student exits early
 *   embedded     – render inline (no full-viewport background) — used by the Generate preview
 *   badgeLabel   – the pill shown in the header (default "My Session")
 */
import React, { useMemo, useRef } from "react";
import SessionFlow from "@/components/session/SessionFlow";
import { dqText, dqAnswer } from "@/lib/caseStudy";

const LETTER_TO_INDEX = { A: 0, B: 1, C: 2, D: 3 };

function getYouTubeVideoId(url) {
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
  // discussion_questions items may be plain strings or { question, answer }.
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
function toQuizQuestion(q, i) {
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
// Shared by single sessions and assigned sessions (same payload shape).
export function bundlePayloadToContent(payload, { badgeLabel = "My Session", sourceUrl = "" } = {}) {
  const p = payload || {};
  const video = p.video || {};
  const videoId =
    video.videoId ||
    getYouTubeVideoId(video.video_url) ||
    getYouTubeVideoId(video.url) ||
    getYouTubeVideoId(sourceUrl) ||
    null;
  return {
    topic: video.title || p.title || "Learning session",
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

export default function SelfSessionPhases({
  payload,
  onComplete,
  onFinish,
  onExit,
  embedded = false,
  badgeLabel = "My Session",
}) {
  const content = useMemo(() => bundlePayloadToContent(payload, { badgeLabel }), [payload, badgeLabel]);

  // Accumulate responses as the student plays.
  const quizResponsesRef = useRef([]);
  const acResponsesRef = useRef([]);
  const caseResponseRef = useRef(null);

  const events = {
    onQuizAnswer: ({ question, selectedIndex, isCorrect, index }) => {
      quizResponsesRef.current.push({
        q_index: index,
        picked: question.options?.[selectedIndex] ?? null,
        correct: question.options?.[question.correctIndex] ?? null,
        is_correct: !!isCorrect,
      });
    },
    onAttentionCheck: ({ check, selectedChoice, isCorrect, index }) => {
      acResponsesRef.current.push({ q_index: index, picked: selectedChoice, correct: check.correct_choice, is_correct: !!isCorrect });
    },
  };

  const handleCaseStudySave = async (csPayload) => {
    caseResponseRef.current = csPayload;
  };

  const buildCompletion = ({ score, mcCorrect, quizTotal }) => {
    const caseResp = caseResponseRef.current;
    return {
      score,
      quiz_score_pct: quizTotal > 0 ? Math.round((mcCorrect / quizTotal) * 100) : null,
      case_study_score: caseResp ? caseResp.total_score : null,
      case_study_max: caseResp ? 4 : null,
      quiz_responses: quizResponsesRef.current.length ? quizResponsesRef.current : null,
      attention_check_responses: acResponsesRef.current.length ? acResponsesRef.current : null,
      case_study_responses: caseResp ? [caseResp] : null,
    };
  };

  const handleFinish = (result) => {
    const completion = buildCompletion(result);
    onComplete?.(completion);
    onFinish?.(completion);
  };

  return (
    <SessionFlow
      content={content}
      embedded={embedded}
      inquiryMode="inline"
      events={events}
      onCaseStudySave={handleCaseStudySave}
      onFinish={handleFinish}
      onExit={() => onExit?.()}
    />
  );
}
