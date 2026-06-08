/**
 * AssignedSessionPlay — student-facing player for a teacher-assigned
 * learning session bundle. Walks the bundle payload inline (no slideshow):
 * inquiry hook → video → quiz → case study.
 *
 * Progress is tracked in student_bundle_completion at the
 * (student_id, assignment_id) grain. If the student already submitted,
 * their answers are re-hydrated and the quiz locks; "Try again" wipes
 * the row so they can re-attempt.
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
  Loader2,
  PlayCircle,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  XCircle,
  Trophy,
  RotateCcw,
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

  // Per-question selected letter + revealed state
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

      // Existing completion? Re-hydrate state so the quiz locks in
      // whatever the student picked last time. .maybeSingle() returns null
      // (not an error) when there's no row.
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

  const isLocked = !!completion;
  const answeredCount = Object.keys(selected).length;
  const allAnswered = quiz.length > 0 && answeredCount === quiz.length;

  const choose = (qIdx, letter) => {
    if (isLocked) return;
    setSelected((prev) => ({ ...prev, [qIdx]: letter }));
    // Auto-reveal the moment a letter is picked so students see correctness
    // inline as they go — matches the existing single-question reveal UX.
    setRevealed((prev) => ({ ...prev, [qIdx]: true }));
  };

  const handleSubmit = async () => {
    if (!user || !assignment || submitting) return;
    setSubmitting(true);
    try {
      const responses = quiz.map((q, i) => {
        const picked = selected[i] || null;
        const correct = (q.correct_choice || "").toLowerCase() || null;
        return {
          q_index: i,
          picked,
          correct,
          is_correct: !!picked && !!correct && picked === correct,
        };
      });
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

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: '"Inter", sans-serif' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

      <div className="max-w-4xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate(createPageUrl("LearningHub"))}
          className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Learning Hub
        </button>

        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Assigned learning session
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-1">
            {bundle?.title || video.title || "Learning session"}
          </h1>
          {assignment?.due_at && (
            <p className="text-sm text-slate-500">
              Due {new Date(assignment.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>

        {completion && (
          <Card className="border border-emerald-200 bg-emerald-50 mb-6">
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    {quiz.length > 0
                      ? `You scored ${completion.quiz_correct}/${completion.quiz_total} (${completion.quiz_score_pct}%)`
                      : "Marked complete"}
                  </p>
                  <p className="text-xs text-emerald-700">
                    Submitted {new Date(completion.completed_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleRetry}
                disabled={submitting}
                className="border-emerald-300 text-emerald-800 hover:bg-emerald-100"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" /> Try again
              </Button>
            </CardContent>
          </Card>
        )}

        {inquiry?.hook_question && (
          <Card className="border border-slate-200 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="w-5 h-5 text-amber-600" />
                <h2 className="text-base font-semibold text-slate-900">Think first</h2>
              </div>
              <p className="text-slate-800 leading-relaxed">{inquiry.hook_question}</p>
              {inquiry.tutor_first_message && (
                <p className="text-sm text-slate-500 mt-3 italic">{inquiry.tutor_first_message}</p>
              )}
            </CardContent>
          </Card>
        )}

        {videoEmbedSrc && (
          <Card className="border border-slate-200 mb-6 overflow-hidden">
            <div className="aspect-video bg-black">
              <iframe
                src={videoEmbedSrc}
                title={video.title || "Video"}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
            {video.title && (
              <div className="px-4 py-3 flex items-center gap-2 text-sm text-slate-700">
                <PlayCircle className="w-4 h-4 text-slate-400" />
                <span className="font-medium">{video.title}</span>
              </div>
            )}
          </Card>
        )}

        {!videoEmbedSrc && bundle?.source_url && (
          <Card className="border border-slate-200 mb-6">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="text-sm text-slate-700">
                <p className="font-medium">Source material</p>
                <p className="text-xs text-slate-500 truncate max-w-md">{bundle.source_url}</p>
              </div>
              <a
                href={bundle.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Open ↗
              </a>
            </CardContent>
          </Card>
        )}

        {quiz.length > 0 && (
          <Card className="border border-slate-200 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Quiz</h2>
                  <p className="text-xs text-slate-500">
                    {quiz.length} questions
                    {!isLocked && ` · ${answeredCount}/${quiz.length} answered`}
                  </p>
                </div>
              </div>
              <ol className="space-y-4">
                {quiz.map((q, i) => {
                  const correctLetter = (q.correct_choice || "").toLowerCase();
                  const isRevealed = !!revealed[i];
                  const pick = selected[i];
                  return (
                    <li key={i} className="border border-slate-200 rounded-xl p-4">
                      <p className="font-medium text-slate-900 mb-3">
                        <span className="text-slate-400 mr-2">{i + 1}.</span>
                        {q.question}
                      </p>
                      <ul className="space-y-2">
                        {LETTERS.map((letter) => {
                          const text = q[`choice_${letter}`];
                          if (!text) return null;
                          const isPicked = pick === letter;
                          const isCorrect = isRevealed && correctLetter === letter;
                          const isWrongPick = isRevealed && isPicked && correctLetter !== letter;
                          return (
                            <li key={letter}>
                              <button
                                onClick={() => choose(i, letter)}
                                disabled={isLocked}
                                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all flex items-center gap-2 ${
                                  isCorrect
                                    ? "border-green-300 bg-green-50 text-green-900"
                                    : isWrongPick
                                    ? "border-red-300 bg-red-50 text-red-900"
                                    : isPicked
                                    ? "border-blue-400 bg-blue-50 text-blue-900"
                                    : `border-slate-200 text-slate-800 ${isLocked ? "" : "hover:border-slate-300"}`
                                }`}
                              >
                                <span className="font-semibold w-5">{letter.toUpperCase()}.</span>
                                <span className="flex-1">{text}</span>
                                {isCorrect && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                                {isWrongPick && <XCircle className="w-4 h-4 text-red-600" />}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {isRevealed && q.explanation && (
                        <p className="mt-3 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                          <span className="font-semibold text-slate-700">Why:</span> {q.explanation}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        )}

        {caseStudy?.scenario && (
          <Card className="border border-slate-200 mb-6">
            <CardContent className="p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-3">Case study</h2>
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
            </CardContent>
          </Card>
        )}

        {!inquiry && !videoEmbedSrc && !bundle?.source_url && quiz.length === 0 && !caseStudy?.scenario && (
          <Card className="border border-slate-200">
            <CardContent className="p-8 text-center">
              <p className="text-slate-600">This session doesn't have any content yet. Check back later.</p>
            </CardContent>
          </Card>
        )}

        {!isLocked && (quiz.length > 0 || videoEmbedSrc || bundle?.source_url) && (
          <div className="sticky bottom-4 z-10">
            <Card className="border border-blue-200 shadow-lg">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="text-sm text-slate-700">
                  {quiz.length > 0 ? (
                    <>
                      <span className="font-semibold">{answeredCount}/{quiz.length}</span> questions answered
                      {!allAnswered && <span className="text-slate-500"> · answer them all to submit</span>}
                    </>
                  ) : (
                    <span>Mark this session complete when you're done.</span>
                  )}
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || (quiz.length > 0 && !allAnswered)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                    </>
                  ) : quiz.length > 0 ? (
                    "Submit & finish"
                  ) : (
                    "Mark complete"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {error && bundle && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-4">{error}</p>
        )}
      </div>
    </div>
  );
}
