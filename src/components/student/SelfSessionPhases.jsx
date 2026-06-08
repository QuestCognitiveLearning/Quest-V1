/**
 * SelfSessionPhases — shared phased player used by both the Generate
 * page (right after a student generates a session) and SelfSessionPlay
 * (when a student opens a scheduled session from the Learning Hub).
 *
 * Phase order (each only rendered if the bundle's payload has content
 * AND the student didn't skip earlier):
 *
 *   summary → video + attention checks → quiz → case_study (4-part) → done
 *
 * Every phase has a Skip button. Quiz auto-grades on pick. Case study
 * walks 4 free-response questions (a / b / c / d) and grades them via
 * invokeLLM (CASE_STUDY_GRADING) like the existing NewSession flow.
 *
 * onComplete fires once when the student lands on "done" — the parent
 * uses it to persist quiz/case-study scores back to its row.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/components/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { invokeLLM } from "@/components/utils/openai";
import { LLM_MODELS } from "@/lib/llmModels";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Trophy,
  Send,
  SkipForward,
  PlayCircle,
  BookOpen,
  MessageCircle,
  Sparkles,
} from "lucide-react";

const LETTERS = ["a", "b", "c", "d"];

export default function SelfSessionPhases({
  payload,
  onComplete,
  onSavePrompt,    // optional: render a Save button under the Done screen
  saving,
  saveLabel = "Save to library",
}) {
  const summary = payload?.summary || null;        // { bullets: [...] } or null
  const video = payload?.video || {};
  const attentionChecks = Array.isArray(payload?.attention_checks) ? payload.attention_checks : [];
  const quiz = Array.isArray(payload?.quiz) ? payload.quiz : [];
  const caseStudy = payload?.case_study || null;
  const videoId = video?.videoId || null;
  const videoEmbedSrc = videoId ? `https://www.youtube.com/embed/${videoId}?rel=0&enablejsapi=1` : null;

  // The phase list is fixed by payload content. Even if the student
  // toggles attention checks off in Generate, those are simply absent
  // from the payload — no separate flag is needed here.
  const phases = useMemo(() => {
    const out = [];
    if (summary?.bullets?.length) out.push("summary");
    if (videoEmbedSrc) out.push("video");
    if (quiz.length > 0) out.push("quiz");
    if (caseStudy?.scenario) out.push("case_study");
    out.push("done");
    return out;
  }, [summary, videoEmbedSrc, quiz.length, caseStudy]);

  const [phaseIdx, setPhaseIdx] = useState(0);
  const phase = phases[phaseIdx] || "done";

  const goNext = () => setPhaseIdx((i) => Math.min(i + 1, phases.length - 1));

  // ===== Quiz state =====
  const [qIdx, setQIdx] = useState(0);
  const [quizSelected, setQuizSelected] = useState({}); // { [i]: 'a' }
  const [quizRevealed, setQuizRevealed] = useState({});
  const [quizSkipped, setQuizSkipped] = useState({});

  const pickQuiz = (letter) => {
    if (quizRevealed[qIdx] || quizSkipped[qIdx]) return;
    setQuizSelected((p) => ({ ...p, [qIdx]: letter }));
    setQuizRevealed((p) => ({ ...p, [qIdx]: true }));
  };
  const skipQuestion = () => {
    setQuizSkipped((p) => ({ ...p, [qIdx]: true }));
    if (qIdx + 1 < quiz.length) setQIdx((i) => i + 1);
    else goNext();
  };
  const nextQuiz = () => {
    if (qIdx + 1 < quiz.length) setQIdx((i) => i + 1);
    else goNext();
  };

  // ===== Video state (attention checks) =====
  const [ytPlayer, setYtPlayer] = useState(null);
  const [activeCheck, setActiveCheck] = useState(null);
  const [checkIdx, setCheckIdx] = useState(0);
  const [checksDone, setChecksDone] = useState([]);
  const [checkSelected, setCheckSelected] = useState(null);
  const [checkFeedback, setCheckFeedback] = useState(null);
  const [acResponses, setAcResponses] = useState([]); // [{ q_index, picked, correct, is_correct }]
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (phase !== "video" || !videoEmbedSrc || ytPlayer) return;
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
    const init = () => {
      const el = document.getElementById("self-yt-player");
      if (!el) return setTimeout(init, 150);
      if (!window.YT || !window.YT.Player) return setTimeout(init, 200);
      try {
        new window.YT.Player("self-yt-player", {
          height: "100%",
          width: "100%",
          videoId,
          playerVars: { controls: 1, modestbranding: 1, rel: 0, autoplay: 1, enablejsapi: 1 },
          events: {
            onReady: (e) => setYtPlayer(e.target),
          },
        });
      } catch (err) {
        console.error("YT init failed:", err);
      }
    };
    setTimeout(init, 300);
  }, [phase, videoEmbedSrc, ytPlayer, videoId]);

  useEffect(() => {
    if (phase !== "video" || !ytPlayer || attentionChecks.length === 0) return;
    const id = setInterval(() => {
      if (!ytPlayer.getCurrentTime || !ytPlayer.getPlayerState) return;
      const state = ytPlayer.getPlayerState();
      const t = ytPlayer.getCurrentTime();
      if (activeCheck) {
        if (state === 1) ytPlayer.pauseVideo();
        return;
      }
      if (t > lastTimeRef.current + 2) {
        ytPlayer.seekTo(lastTimeRef.current, true);
        return;
      }
      if (state === 1) {
        lastTimeRef.current = t;
        const next = attentionChecks[checkIdx];
        if (next && Math.abs(t - next.timestamp) <= 1 && !checksDone.includes(checkIdx)) {
          ytPlayer.pauseVideo();
          setActiveCheck(next);
          setCheckSelected(null);
          setCheckFeedback(null);
        }
      }
    }, 500);
    return () => clearInterval(id);
  }, [phase, ytPlayer, activeCheck, checkIdx, checksDone, attentionChecks]);

  const submitCheck = () => {
    if (!activeCheck || !checkSelected) return;
    const correctLetter = String(activeCheck.correct_choice || "A").toUpperCase();
    const isCorrect = checkSelected === correctLetter;
    setCheckFeedback({ correct: isCorrect });
    setAcResponses((prev) => [
      ...prev,
      { q_index: checkIdx, picked: checkSelected, correct: correctLetter, is_correct: isCorrect },
    ]);
    setTimeout(() => {
      setChecksDone((prev) => [...prev, checkIdx]);
      setActiveCheck(null);
      setCheckSelected(null);
      setCheckFeedback(null);
      setCheckIdx((i) => i + 1);
      if (ytPlayer) ytPlayer.playVideo();
    }, 1200);
  };

  const skipCheck = () => {
    if (!activeCheck) return;
    setChecksDone((prev) => [...prev, checkIdx]);
    setActiveCheck(null);
    setCheckSelected(null);
    setCheckFeedback(null);
    setCheckIdx((i) => i + 1);
    if (ytPlayer) ytPlayer.playVideo();
  };

  // ===== Case study (4-part) =====
  // Use discussion_questions[] (or question_a/b/c/d if generator added them)
  // as the 4 prompts. Free-response per prompt, graded all-at-once at the
  // end via invokeLLM.
  const csQuestions = useMemo(() => {
    if (!caseStudy) return [];
    if (Array.isArray(caseStudy.discussion_questions) && caseStudy.discussion_questions.length > 0) {
      return caseStudy.discussion_questions.slice(0, 4);
    }
    const fromKeys = ["question_a", "question_b", "question_c", "question_d"]
      .map((k) => caseStudy[k])
      .filter(Boolean);
    return fromKeys;
  }, [caseStudy]);

  const [csIdx, setCsIdx] = useState(0);
  const [csAnswers, setCsAnswers] = useState([]); // strings
  const [csInput, setCsInput] = useState("");
  const [csGrading, setCsGrading] = useState(false);
  const [csResult, setCsResult] = useState(null); // { responses[], score, max }
  const [csError, setCsError] = useState("");

  const submitCsAnswer = () => {
    const t = csInput.trim();
    if (!t) return;
    const next = [...csAnswers, t];
    setCsAnswers(next);
    setCsInput("");
    if (csIdx + 1 < csQuestions.length) {
      setCsIdx((i) => i + 1);
    } else {
      gradeCs(next);
    }
  };

  const skipCsAnswer = () => {
    const next = [...csAnswers, ""];
    setCsAnswers(next);
    setCsInput("");
    if (csIdx + 1 < csQuestions.length) {
      setCsIdx((i) => i + 1);
    } else {
      gradeCs(next);
    }
  };

  const gradeCs = async (answers) => {
    setCsGrading(true);
    setCsError("");
    try {
      const promptBody = csQuestions
        .map((q, i) => `Q${i + 1}: ${q}\nSTUDENT ANSWER ${i + 1}: ${answers[i] || "SKIPPED"}`)
        .join("\n\n");
      const schema = {
        type: "object",
        properties: {
          scores: {
            type: "array",
            items: {
              type: "object",
              properties: {
                q_index: { type: "integer" },
                score: { type: "number" },
                feedback: { type: "string" },
              },
              required: ["q_index", "score", "feedback"],
            },
          },
          total_score: { type: "number" },
        },
        required: ["scores", "total_score"],
      };
      const result = await invokeLLM({
        model: LLM_MODELS.CASE_STUDY_GRADING,
        prompt: `You are Panda, an AI tutor grading a student's 4-part case study about "${video?.title || "this topic"}".

Case study scenario:
${caseStudy.scenario}

Grade each answer 0 / 0.5 / 1:
- 0 = skipped, blank, or completely misses the key concepts
- 0.5 = partial credit (some concepts present, incomplete)
- 1 = full credit (captures the key concepts, even if worded differently)

Empty answers, "idk", "skip" = 0.
Speak directly to the student in feedback ("you..."). One or two sentences each.

${promptBody}

Return JSON: { scores: [{q_index, score, feedback}, ...], total_score }`,
        response_json_schema: schema,
      });
      const max = csQuestions.length;
      const responses = csQuestions.map((q, i) => {
        const s = (result?.scores || []).find((x) => x.q_index === i) || {};
        return {
          q_index: i,
          question: q,
          answer: answers[i] || "",
          score: typeof s.score === "number" ? s.score : 0,
          max: 1,
          feedback: s.feedback || "",
        };
      });
      const score =
        typeof result?.total_score === "number"
          ? result.total_score
          : responses.reduce((a, r) => a + (r.score || 0), 0);
      setCsResult({ responses, score, max });
    } catch (err) {
      console.error("CS grading failed:", err);
      setCsError("Couldn't grade automatically — partial credit applied.");
      const max = csQuestions.length;
      const responses = csQuestions.map((q, i) => ({
        q_index: i,
        question: q,
        answer: answers[i] || "",
        score: answers[i]?.trim() ? 0.5 : 0,
        max: 1,
        feedback: "",
      }));
      setCsResult({
        responses,
        score: responses.reduce((a, r) => a + r.score, 0),
        max,
      });
    } finally {
      setCsGrading(false);
    }
  };

  const skipCsSection = () => {
    setCsResult({ responses: [], score: 0, max: csQuestions.length });
  };

  // ===== Score derivation =====
  const quizResponses = quiz.map((q, i) => {
    const picked = quizSelected[i] || null;
    const correct = String(q.correct_choice || "A").toLowerCase();
    return {
      q_index: i,
      picked,
      correct,
      is_correct: !!picked && picked === correct,
      skipped: !!quizSkipped[i],
    };
  });
  const quizAnswered = quizResponses.filter((r) => r.picked).length;
  const quizCorrect = quizResponses.filter((r) => r.is_correct).length;
  const quizPct = quiz.length > 0
    ? Math.round((quizCorrect / quiz.length) * 100)
    : null;

  // Fire onComplete the first time we reach the done phase.
  const completedRef = useRef(false);
  useEffect(() => {
    if (phase !== "done" || completedRef.current) return;
    completedRef.current = true;
    onComplete?.({
      quiz_total: quiz.length,
      quiz_correct: quiz.length > 0 ? quizCorrect : null,
      quiz_score_pct: quizPct,
      quiz_responses: quizResponses,
      attention_check_responses: acResponses,
      case_study_responses: csResult?.responses || null,
      case_study_score: csResult?.score ?? null,
      case_study_max: csResult?.max ?? null,
    });
  }, [phase, quiz.length, quizCorrect, quizPct, acResponses, csResult, onComplete, quizResponses]);

  // ===== Render =====
  return (
    <div className="space-y-4">
      <PhaseDots phases={phases} current={phaseIdx} />

      {phase === "summary" && summary && (
        <Panel
          icon={<BookOpen className="w-5 h-5 text-blue-600" />}
          tag="Summary"
          tagClass="bg-blue-100 text-blue-700"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-3">
            Before you watch — what this video covers
          </h3>
          <ul className="space-y-2 mb-5">
            {summary.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
          <PhaseActions onContinue={goNext} continueLabel="I'm ready — watch the video →" />
        </Panel>
      )}

      {phase === "video" && (
        <Panel
          icon={<PlayCircle className="w-5 h-5 text-emerald-600" />}
          tag={video?.title ? video.title : "Watch"}
          tagClass="bg-emerald-100 text-emerald-700"
        >
          {videoEmbedSrc ? (
            <div className="aspect-video bg-black rounded-xl overflow-hidden border border-slate-200">
              <div id="self-yt-player" className="w-full h-full" />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Video unavailable.</p>
          )}

          {activeCheck && (
            <div className="mt-4 border-2 border-indigo-300 bg-indigo-50 rounded-2xl p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 mb-2">
                Attention check
              </div>
              <p className="font-semibold text-slate-900 mb-3">{activeCheck.question}</p>
              <div className="space-y-2">
                {LETTERS.map((k) => {
                  const letter = k.toUpperCase();
                  const text = activeCheck[`choice_${k}`];
                  if (!text) return null;
                  const isSel = checkSelected === letter;
                  const showResult = !!checkFeedback;
                  const isCorrect = letter === String(activeCheck.correct_choice || "A").toUpperCase();
                  let cls = "border-slate-200 bg-white";
                  if (showResult && isCorrect) cls = "border-emerald-500 bg-emerald-50";
                  else if (showResult && isSel && !isCorrect) cls = "border-red-400 bg-red-50";
                  else if (isSel) cls = "border-indigo-500 bg-indigo-50";
                  return (
                    <button
                      key={k}
                      disabled={showResult}
                      onClick={() => setCheckSelected(letter)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left ${cls}`}
                    >
                      <span className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-xs font-bold">
                        {letter}
                      </span>
                      <span className="flex-1 text-slate-900 text-sm">{text}</span>
                      {showResult && isCorrect && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-3 gap-2">
                <Button variant="ghost" onClick={skipCheck} className="text-slate-500">
                  <SkipForward className="w-4 h-4 mr-1.5" /> Skip
                </Button>
                {!checkFeedback ? (
                  <Button onClick={submitCheck} disabled={!checkSelected} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    Submit
                  </Button>
                ) : (
                  <p className={`text-sm font-semibold ${checkFeedback.correct ? "text-emerald-700" : "text-amber-700"}`}>
                    {checkFeedback.correct ? "Nice — correct." : "Not quite."}
                  </p>
                )}
              </div>
            </div>
          )}

          <PhaseActions
            onContinue={goNext}
            continueLabel="I've watched it →"
            onSkip={goNext}
            skipLabel="Skip"
          />
        </Panel>
      )}

      {phase === "quiz" && quiz[qIdx] && (
        <Panel
          icon={<BookOpen className="w-5 h-5 text-violet-600" />}
          tag={`Quiz · question ${qIdx + 1} of ${quiz.length}`}
          tagClass="bg-violet-100 text-violet-700"
        >
          <QuizQuestion
            q={quiz[qIdx]}
            picked={quizSelected[qIdx] || null}
            revealed={!!quizRevealed[qIdx]}
            onPick={pickQuiz}
          />
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={skipQuestion} className="text-slate-500">
                <SkipForward className="w-4 h-4 mr-1.5" /> Skip question
              </Button>
              <Button variant="ghost" onClick={goNext} className="text-slate-400 text-xs">
                Skip whole quiz
              </Button>
            </div>
            <Button
              onClick={nextQuiz}
              disabled={!quizRevealed[qIdx]}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {qIdx + 1 < quiz.length ? "Next question →" : "Finish quiz →"}
            </Button>
          </div>
        </Panel>
      )}

      {phase === "case_study" && caseStudy && (
        <Panel
          icon={<MessageCircle className="w-5 h-5 text-amber-700" />}
          tag="Case study (graded by Panda)"
          tagClass="bg-amber-100 text-amber-800"
        >
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <p className="text-slate-800 leading-relaxed whitespace-pre-line text-sm">
              {caseStudy.scenario}
            </p>
          </div>

          {!csResult ? (
            csQuestions.length === 0 ? (
              <>
                <p className="text-sm text-slate-500">No discussion questions on this case study.</p>
                <PhaseActions onContinue={goNext} continueLabel="Continue →" />
              </>
            ) : (
              <>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Part ({"abcd"[csIdx]}) · {csIdx + 1} of {csQuestions.length}
                </div>
                <p className="font-semibold text-slate-900 mb-3">{csQuestions[csIdx]}</p>
                <Textarea
                  rows={4}
                  value={csInput}
                  onChange={(e) => setCsInput(e.target.value)}
                  placeholder="Type your answer…"
                  disabled={csGrading}
                />
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                  <Button variant="ghost" onClick={skipCsAnswer} disabled={csGrading} className="text-slate-500">
                    <SkipForward className="w-4 h-4 mr-1.5" /> Skip part
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={skipCsSection} disabled={csGrading} className="text-slate-400 text-xs">
                      Skip whole case study
                    </Button>
                    <Button
                      onClick={submitCsAnswer}
                      disabled={csGrading || !csInput.trim()}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {csGrading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Grading…
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-1.5" />
                          {csIdx + 1 < csQuestions.length ? "Submit part →" : "Submit & grade →"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                {csError && <p className="text-xs text-red-600 mt-2">{csError}</p>}
              </>
            )
          ) : (
            <>
              <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-sm font-bold text-amber-900 mb-1">
                  Panda's grading · {csResult.score}/{csResult.max}
                </p>
                {csResult.responses.length === 0 && (
                  <p className="text-xs text-slate-600">Case study skipped — no score recorded.</p>
                )}
              </div>
              <ol className="space-y-2 mb-4">
                {csResult.responses.map((r, i) => (
                  <li
                    key={i}
                    className={`p-3 rounded-lg border text-sm ${
                      r.score === r.max
                        ? "border-emerald-200 bg-emerald-50"
                        : r.score > 0
                        ? "border-amber-200 bg-amber-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <p className="font-medium text-slate-900 mb-1">
                      ({"abcd"[i]}) {r.question}
                    </p>
                    <p className="text-xs text-slate-700 mb-1">
                      <span className="font-semibold">Your answer:</span>{" "}
                      {r.answer || <em className="text-slate-500">skipped</em>}
                    </p>
                    <p className="text-xs text-slate-700 mb-0.5">
                      <span className="font-semibold">Score:</span> {r.score}/{r.max}
                    </p>
                    {r.feedback && (
                      <p className="text-xs text-slate-700 italic mt-1">{r.feedback}</p>
                    )}
                  </li>
                ))}
              </ol>
              <PhaseActions onContinue={goNext} continueLabel="Continue →" />
            </>
          )}
        </Panel>
      )}

      {phase === "done" && (
        <Panel
          icon={<Trophy className="w-5 h-5 text-emerald-700" />}
          tag="Session complete"
          tagClass="bg-emerald-100 text-emerald-800"
        >
          <div className="text-center mb-5">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <Trophy className="w-7 h-7 text-emerald-700" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900">Nice work!</h3>
          </div>

          <div className="space-y-2 mb-5">
            {quiz.length > 0 && (
              <ScoreRow
                label="Quiz"
                score={`${quizCorrect}/${quiz.length}`}
                pct={quizPct}
                color="violet"
                detail={quizAnswered < quiz.length ? `${quiz.length - quizAnswered} skipped` : null}
              />
            )}
            {csResult && csResult.max > 0 && (
              <ScoreRow
                label="Case study (Panda-graded)"
                score={`${csResult.score}/${csResult.max}`}
                pct={Math.round((csResult.score / csResult.max) * 100)}
                color="amber"
              />
            )}
            {acResponses.length > 0 && (
              <ScoreRow
                label="Attention checks"
                score={`${acResponses.filter((r) => r.is_correct).length}/${acResponses.length}`}
                pct={Math.round(
                  (acResponses.filter((r) => r.is_correct).length / acResponses.length) * 100
                )}
                color="emerald"
              />
            )}
          </div>

          {onSavePrompt && (
            <div className="pt-4 border-t border-slate-100">
              {onSavePrompt(saving, saveLabel)}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

// =============================================================================

function Panel({ icon, tag, tagClass, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md">
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-3 ${tagClass}`}>
        {icon} {tag}
      </div>
      {children}
    </div>
  );
}

function PhaseDots({ phases, current }) {
  return (
    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm w-fit">
      {phases.map((p, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === current ? "w-6 bg-indigo-600" : i < current ? "w-3 bg-indigo-400" : "w-3 bg-slate-200"
          }`}
          title={p}
        />
      ))}
    </div>
  );
}

function PhaseActions({ onContinue, continueLabel, onSkip, skipLabel }) {
  return (
    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
      {onSkip ? (
        <Button variant="ghost" onClick={onSkip} className="text-slate-500">
          <SkipForward className="w-4 h-4 mr-1.5" /> {skipLabel || "Skip"}
        </Button>
      ) : (
        <span />
      )}
      <Button onClick={onContinue} className="bg-indigo-600 hover:bg-indigo-700 text-white">
        {continueLabel}
      </Button>
    </div>
  );
}

function QuizQuestion({ q, picked, revealed, onPick }) {
  const correctLetter = String(q.correct_choice || "A").toLowerCase();
  return (
    <>
      <p className="text-lg font-semibold text-slate-900 mb-4">{q.question}</p>
      <ul className="space-y-2">
        {LETTERS.map((letter) => {
          const text = q[`choice_${letter}`];
          if (!text) return null;
          const isPicked = picked === letter;
          const isCorrect = revealed && correctLetter === letter;
          const isWrongPick = revealed && isPicked && correctLetter !== letter;
          let cls = "border-slate-200 bg-white hover:border-slate-300";
          if (isCorrect) cls = "border-emerald-500 bg-emerald-50 text-emerald-900";
          else if (isWrongPick) cls = "border-red-400 bg-red-50 text-red-900";
          else if (isPicked) cls = "border-violet-500 bg-violet-50 text-violet-900";
          return (
            <li key={letter}>
              <button
                onClick={() => onPick(letter)}
                disabled={revealed}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all flex items-center gap-3 ${cls}`}
              >
                <span className="w-7 h-7 rounded-md bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                  {letter.toUpperCase()}
                </span>
                <span className="flex-1">{text}</span>
                {isCorrect && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                {isWrongPick && <XCircle className="w-5 h-5 text-red-600" />}
              </button>
            </li>
          );
        })}
      </ul>
      {revealed && q.explanation && (
        <p className="mt-4 text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-lg leading-relaxed">
          <span className="font-semibold text-slate-900">Why:</span> {q.explanation}
        </p>
      )}
    </>
  );
}

function ScoreRow({ label, score, pct, color, detail }) {
  const palette = {
    indigo: "bg-indigo-50 text-indigo-800",
    emerald: "bg-emerald-50 text-emerald-800",
    amber: "bg-amber-50 text-amber-800",
    violet: "bg-violet-50 text-violet-800",
  }[color] || "bg-slate-50 text-slate-800";
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${palette}`}>
      <div>
        <p className="font-semibold text-sm">{label}</p>
        {detail && <p className="text-xs opacity-75 mt-0.5">{detail}</p>}
      </div>
      <span className="text-sm font-bold tabular-nums">
        {score} · {pct ?? 0}%
      </span>
    </div>
  );
}

// Helper for callers that want to use the same supabase + invokeLLM stack
// to write completion. Exported for reuse, not used internally.
export const _selfSessionPhasesInternal = { supabase, invokeLLM, LLM_MODELS, Sparkles };
