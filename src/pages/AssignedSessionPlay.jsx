/**
 * AssignedSessionPlay — student-facing phased player for a teacher-assigned
 * learning session bundle. Walks the bundle in distinct phases like the
 * LiveSessionPlay UX (one screen at a time, Continue advances), but with
 * no live-session participant/leaderboard machinery.
 *
 * Phase order: inquiry → video → quiz → case study → results.
 * Each phase is included only if the payload has the matching content.
 * Quiz phase walks one question at a time; the answer auto-reveals on
 * pick and "Next question" advances. The results phase computes the
 * final score and writes a row to student_bundle_completion.
 *
 * If the student already submitted before, we re-hydrate the saved
 * answers and jump straight to the results phase with a "Try again"
 * button that wipes the completion row and resets to phase 0.
 *
 * RLS requirements:
 *   - 0029 + 0030: students SELECT lesson_bundle_assignments + lesson_bundles
 *   - 0031: students manage their own student_bundle_completion rows
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  PlayCircle,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  XCircle,
  Trophy,
  RotateCcw,
  BookOpen,
  Send,
} from "lucide-react";

const LETTERS = ["a", "b", "c", "d"];

export default function AssignedSessionPlay() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get("assignment_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [bundle, setBundle] = useState(null);

  // Walk state
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState({}); // { [qIdx]: 'a' }
  const [revealed, setRevealed] = useState({}); // { [qIdx]: true }

  // Completion row (if student already submitted)
  const [completion, setCompletion] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!assignmentId) {
      setError("No assignment specified.");
      setLoading(false);
      return;
    }
    loadAll();
  }, [assignmentId]);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const me = await quest.auth.me();
      setUser(me);

      const { data: aRow, error: aErr } = await supabase
        .from("lesson_bundle_assignments")
        .select("id, bundle_id, class_id, due_at, assigned_at")
        .eq("id", assignmentId)
        .single();
      if (aErr) throw aErr;
      setAssignment(aRow);

      const { data: bRow, error: bErr } = await supabase
        .from("lesson_bundles")
        .select("id, title, source_type, source_url, payload, grade_level")
        .eq("id", aRow.bundle_id)
        .single();
      if (bErr) throw bErr;
      setBundle(bRow);

      // Existing completion? Re-hydrate answers and jump to results.
      const { data: cRow } = await supabase
        .from("student_bundle_completion")
        .select("*")
        .eq("student_id", me.id)
        .eq("assignment_id", aRow.id)
        .maybeSingle();
      if (cRow) {
        setCompletion(cRow);
        const sel = {};
        const rev = {};
        for (const r of cRow.quiz_responses || []) {
          if (typeof r.q_index === "number") {
            if (r.picked) sel[r.q_index] = r.picked;
            rev[r.q_index] = true;
          }
        }
        setSelected(sel);
        setRevealed(rev);
      }
    } catch (err) {
      console.error("Failed to load assigned session:", err);
      setError(err?.message || "Could not load this session.");
    } finally {
      setLoading(false);
    }
  };

  const payload = bundle?.payload || {};
  const video = payload.video || {};
  const inquiry = payload.inquiry_session || null;
  const caseStudy = payload.case_study || null;
  const quiz = Array.isArray(payload.quiz) ? payload.quiz : [];

  const videoEmbedSrc = useMemo(() => {
    if (video.videoId) {
      return `https://www.youtube.com/embed/${video.videoId}?rel=0`;
    }
    return null;
  }, [video.videoId]);

  const phases = useMemo(() => {
    const out = [];
    if (inquiry?.hook_question) out.push("inquiry");
    if (videoEmbedSrc || bundle?.source_url) out.push("video");
    if (quiz.length > 0) out.push("quiz");
    if (caseStudy?.scenario) out.push("case_study");
    out.push("results");
    return out;
  }, [inquiry, videoEmbedSrc, bundle?.source_url, quiz.length, caseStudy]);

  // If they've already submitted, jump straight to results on first render.
  useEffect(() => {
    if (completion && phases.length > 0) {
      setPhaseIdx(phases.length - 1);
    }
  }, [completion, phases.length]);

  const currentPhase = phases[phaseIdx];

  const goNext = () => {
    setPhaseIdx((i) => Math.min(i + 1, phases.length - 1));
  };

  const goPrev = () => {
    setPhaseIdx((i) => Math.max(i - 1, 0));
  };

  // ---- Quiz interaction ----
  const choose = (letter) => {
    if (revealed[qIdx] || completion) return;
    setSelected((prev) => ({ ...prev, [qIdx]: letter }));
    setRevealed((prev) => ({ ...prev, [qIdx]: true }));
  };

  const nextQuestion = () => {
    if (qIdx + 1 < quiz.length) {
      setQIdx((i) => i + 1);
    } else {
      goNext();
    }
  };

  // ---- Submit + retry ----
  const computeResponses = () =>
    quiz.map((q, i) => {
      const picked = selected[i] || null;
      const correct = (q.correct_choice || "").toLowerCase() || null;
      return {
        q_index: i,
        picked,
        correct,
        is_correct: !!picked && !!correct && picked === correct,
      };
    });

  const handleSubmit = async () => {
    if (!user || !assignment || submitting) return;
    setSubmitting(true);
    try {
      const responses = computeResponses();
      const total = quiz.length;
      const correct = responses.filter((r) => r.is_correct).length;
      const pct = total > 0 ? Math.round((correct / total) * 100) : null;

      const { data: row, error: upErr } = await supabase
        .from("student_bundle_completion")
        .upsert(
          {
            student_id: user.id,
            assignment_id: assignment.id,
            quiz_total: total || null,
            quiz_correct: total > 0 ? correct : null,
            quiz_score_pct: pct,
            quiz_responses: responses,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "student_id,assignment_id" }
        )
        .select("*")
        .single();
      if (upErr) throw upErr;
      setCompletion(row);
    } catch (err) {
      console.error("Failed to save completion:", err);
      setError(err?.message || "Could not save. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async () => {
    if (!user || !assignment) return;
    setSubmitting(true);
    try {
      await supabase
        .from("student_bundle_completion")
        .delete()
        .eq("student_id", user.id)
        .eq("assignment_id", assignment.id);
      setCompletion(null);
      setSelected({});
      setRevealed({});
      setQIdx(0);
      setPhaseIdx(0);
    } catch (err) {
      console.error("Retry failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !bundle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Can't load this session</h2>
            <p className="text-sm text-slate-600 mb-4">{error}</p>
            <Button onClick={() => navigate(createPageUrl("LearningHub"))} className="bg-blue-600 hover:bg-blue-700 text-white">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Learning Hub
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Live computation for results phase (also used to derive sidebar
  // progress badge during the walk).
  const liveResponses = computeResponses();
  const liveCorrect = liveResponses.filter((r) => r.is_correct).length;
  const livePct = quiz.length > 0 ? Math.round((liveCorrect / quiz.length) * 100) : null;

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 50%, #FAF5FF 100%)",
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Top bar: back + phase progress */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <button
            onClick={() => navigate(createPageUrl("LearningHub"))}
            className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Learning Hub
          </button>
          <PhaseDots phases={phases} current={phaseIdx} />
        </div>

        {/* Title */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Assigned learning session
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-1">
            {bundle?.title || video.title || "Learning session"}
          </h1>
          {assignment?.due_at && (
            <p className="text-sm text-slate-500">
              Due {new Date(assignment.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>

        {/* Phase body */}
        {currentPhase === "inquiry" && (
          <PhaseCard
            icon={<HelpCircle className="w-5 h-5 text-amber-600" />}
            title="Think first"
          >
            <p className="text-slate-800 leading-relaxed text-lg">{inquiry.hook_question}</p>
            {inquiry.tutor_first_message && (
              <p className="text-sm text-slate-500 mt-4 italic">{inquiry.tutor_first_message}</p>
            )}
            <PhaseFooter onContinue={goNext} continueLabel="I've thought about it" />
          </PhaseCard>
        )}

        {currentPhase === "video" && (
          <PhaseCard
            icon={<PlayCircle className="w-5 h-5 text-blue-600" />}
            title={video.title || "Watch"}
          >
            {videoEmbedSrc ? (
              <div className="aspect-video bg-black rounded-xl overflow-hidden">
                <iframe
                  src={videoEmbedSrc}
                  title={video.title || "Video"}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>
            ) : bundle?.source_url ? (
              <div className="border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="text-sm text-slate-700 min-w-0">
                  <p className="font-medium">Source material</p>
                  <p className="text-xs text-slate-500 truncate">{bundle.source_url}</p>
                </div>
                <a
                  href={bundle.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 shrink-0"
                >
                  Open ↗
                </a>
              </div>
            ) : null}
            <PhaseFooter onContinue={goNext} continueLabel="I've watched it" onBack={phaseIdx > 0 ? goPrev : null} />
          </PhaseCard>
        )}

        {currentPhase === "quiz" && quiz[qIdx] && (
          <PhaseCard
            icon={<BookOpen className="w-5 h-5 text-violet-600" />}
            title={`Quiz · question ${qIdx + 1} of ${quiz.length}`}
          >
            <QuizQuestion
              q={quiz[qIdx]}
              picked={selected[qIdx] || null}
              revealed={!!revealed[qIdx]}
              locked={!!completion}
              onPick={choose}
            />
            <PhaseFooter
              onContinue={revealed[qIdx] || completion ? nextQuestion : null}
              continueLabel={
                qIdx + 1 < quiz.length
                  ? "Next question"
                  : "Finish quiz"
              }
              onBack={qIdx > 0 ? () => setQIdx((i) => i - 1) : (phaseIdx > 0 ? goPrev : null)}
              hint={!revealed[qIdx] && !completion ? "Pick an answer to continue" : null}
            />
          </PhaseCard>
        )}

        {currentPhase === "case_study" && (
          <PhaseCard
            icon={<Sparkles className="w-5 h-5 text-violet-600" />}
            title="Case study"
          >
            <p className="text-slate-800 leading-relaxed whitespace-pre-line">{caseStudy.scenario}</p>
            {Array.isArray(caseStudy.discussion_questions) && caseStudy.discussion_questions.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-slate-900 mt-5 mb-2">Discussion questions</h3>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-700">
                  {caseStudy.discussion_questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ol>
              </>
            )}
            <PhaseFooter onContinue={goNext} continueLabel="Continue" onBack={phaseIdx > 0 ? goPrev : null} />
          </PhaseCard>
        )}

        {currentPhase === "results" && (
          <ResultsCard
            quiz={quiz}
            responses={completion?.quiz_responses || liveResponses}
            score={completion ? completion.quiz_score_pct : livePct}
            correct={completion ? completion.quiz_correct : liveCorrect}
            total={completion ? completion.quiz_total : quiz.length}
            submittedAt={completion?.completed_at}
            submitted={!!completion}
            submitting={submitting}
            onSubmit={handleSubmit}
            onRetry={handleRetry}
            onBack={phaseIdx > 0 ? goPrev : null}
            onHome={() => navigate(createPageUrl("LearningHub"))}
          />
        )}

        {error && bundle && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-4">{error}</p>
        )}
      </div>
    </div>
  );
}

// ===================== Subcomponents =====================

function PhaseDots({ phases, current }) {
  return (
    <div className="flex items-center gap-1.5">
      {phases.map((p, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i === current
              ? "w-6 bg-blue-600"
              : i < current
              ? "w-3 bg-blue-400"
              : "w-3 bg-slate-200"
          }`}
          title={p}
        />
      ))}
    </div>
  );
}

function PhaseCard({ icon, title, children }) {
  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-4">
          {icon}
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function PhaseFooter({ onContinue, continueLabel = "Continue", onBack, hint }) {
  return (
    <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button variant="ghost" onClick={onBack} className="text-slate-500">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        )}
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
      <Button
        onClick={onContinue}
        disabled={!onContinue}
        className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed"
      >
        {continueLabel} <ArrowRight className="w-4 h-4 ml-1.5" />
      </Button>
    </div>
  );
}

function QuizQuestion({ q, picked, revealed, locked, onPick }) {
  const correctLetter = (q.correct_choice || "").toLowerCase();
  return (
    <>
      <p className="text-lg font-medium text-slate-900 mb-4">{q.question}</p>
      <ul className="space-y-2">
        {LETTERS.map((letter) => {
          const text = q[`choice_${letter}`];
          if (!text) return null;
          const isPicked = picked === letter;
          const isCorrect = revealed && correctLetter === letter;
          const isWrongPick = revealed && isPicked && correctLetter !== letter;
          const disabled = locked || revealed;
          return (
            <li key={letter}>
              <button
                onClick={() => onPick(letter)}
                disabled={disabled}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center gap-3 ${
                  isCorrect
                    ? "border-green-400 bg-green-50 text-green-900"
                    : isWrongPick
                    ? "border-red-400 bg-red-50 text-red-900"
                    : isPicked
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : `border-slate-200 text-slate-800 ${disabled ? "" : "hover:border-slate-300 hover:bg-slate-50"}`
                }`}
              >
                <span className="font-semibold w-6">{letter.toUpperCase()}.</span>
                <span className="flex-1">{text}</span>
                {isCorrect && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />}
                {isWrongPick && <XCircle className="w-5 h-5 text-red-600 shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>
      {revealed && (
        <div className={`mt-4 px-4 py-3 rounded-xl text-sm ${picked === correctLetter ? "bg-green-50 border border-green-200 text-green-900" : "bg-amber-50 border border-amber-200 text-amber-900"}`}>
          <p className="font-semibold mb-1">
            {picked === correctLetter
              ? "Correct!"
              : `The correct answer is ${correctLetter.toUpperCase()}.`}
          </p>
          {q.explanation && <p className="text-slate-700">{q.explanation}</p>}
        </div>
      )}
    </>
  );
}

function ResultsCard({
  quiz,
  responses,
  score,
  correct,
  total,
  submittedAt,
  submitted,
  submitting,
  onSubmit,
  onRetry,
  onBack,
  onHome,
}) {
  const hasQuiz = (total || 0) > 0;
  const passed = hasQuiz && score >= 70;

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardContent className="p-6 sm:p-8">
        <div className="text-center mb-6">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              !submitted
                ? "bg-blue-100"
                : passed
                ? "bg-emerald-100"
                : "bg-amber-100"
            }`}
          >
            <Trophy
              className={`w-8 h-8 ${
                !submitted ? "text-blue-600" : passed ? "text-emerald-700" : "text-amber-700"
              }`}
            />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-1">
            {submitted ? "Session complete" : "Ready to submit?"}
          </h2>
          {hasQuiz ? (
            <>
              <p className="text-4xl font-bold mt-3 mb-1 tabular-nums">
                <span className={passed ? "text-emerald-700" : submitted ? "text-amber-700" : "text-slate-900"}>
                  {score}%
                </span>
              </p>
              <p className="text-sm text-slate-600">
                {correct} of {total} correct
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              {submitted ? "Marked complete." : "Mark this session complete when you're ready."}
            </p>
          )}
          {submitted && submittedAt && (
            <p className="text-xs text-slate-400 mt-2">
              Submitted {new Date(submittedAt).toLocaleString()}
            </p>
          )}
        </div>

        {hasQuiz && (
          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Question review</h3>
            <ol className="space-y-2">
              {quiz.map((q, i) => {
                const r = responses[i] || {};
                return (
                  <li
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                      r.is_correct
                        ? "border-green-200 bg-green-50"
                        : r.picked
                        ? "border-red-200 bg-red-50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    {r.is_correct ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 text-sm line-clamp-2">
                        {i + 1}. {q.question}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Your answer: <span className="font-semibold">{r.picked ? r.picked.toUpperCase() : "—"}</span>
                        {!r.is_correct && r.correct && (
                          <>
                            {" "}· Correct: <span className="font-semibold text-green-700">{r.correct.toUpperCase()}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          {!submitted ? (
            <>
              {onBack && (
                <Button variant="ghost" onClick={onBack} className="text-slate-500">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              )}
              <Button
                onClick={onSubmit}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white ml-auto"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1.5" /> {hasQuiz ? "Submit & finish" : "Mark complete"}
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={onRetry}
                disabled={submitting}
                className="border-slate-300"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" /> Try again
              </Button>
              <Button
                onClick={onHome}
                className="bg-blue-600 hover:bg-blue-700 text-white ml-auto"
              >
                Back to Learning Hub <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
