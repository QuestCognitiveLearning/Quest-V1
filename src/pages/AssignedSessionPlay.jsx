/**
 * AssignedSessionPlay — student-facing read-only player for a learning
 * session a teacher assigned to their class via Generate → "Assign to class".
 *
 * Loads a `lesson_bundle_assignments` row by ID, then the parent
 * `lesson_bundles.payload` (the raw generated session). Renders the four
 * canonical phases inline (no slideshow): inquiry hook → video → quiz with
 * per-question reveal → case study. v1 has no scoring or progress write-back;
 * students can re-open any time.
 *
 * Required RLS (migration 0029): enrolled students get SELECT on
 * lesson_bundle_assignments + lesson_bundles for their classes.
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
} from "lucide-react";

const LETTERS = ["a", "b", "c", "d"];

export default function AssignedSessionPlay() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get("assignment_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignment, setAssignment] = useState(null);
  const [bundle, setBundle] = useState(null);

  // Per-question selected letter + revealed state
  const [selected, setSelected] = useState({}); // { [qIdx]: 'a' }
  const [revealed, setRevealed] = useState({}); // { [qIdx]: true }

  useEffect(() => {
    if (!assignmentId) {
      setError("No assignment specified.");
      setLoading(false);
      return;
    }
    loadAssignment();
  }, [assignmentId]);

  const loadAssignment = async () => {
    setLoading(true);
    setError("");
    try {
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

  const choose = (qIdx, letter) => {
    if (revealed[qIdx]) return;
    setSelected((prev) => ({ ...prev, [qIdx]: letter }));
  };

  const reveal = (qIdx) => {
    setRevealed((prev) => ({ ...prev, [qIdx]: true }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
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
              <h2 className="text-base font-semibold text-slate-900 mb-1">Quiz</h2>
              <p className="text-xs text-slate-500 mb-4">{quiz.length} questions · pick an answer to see if you got it right</p>
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
                                disabled={isRevealed}
                                className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all flex items-center gap-2 ${
                                  isCorrect
                                    ? "border-green-300 bg-green-50 text-green-900"
                                    : isWrongPick
                                    ? "border-red-300 bg-red-50 text-red-900"
                                    : isPicked
                                    ? "border-blue-400 bg-blue-50 text-blue-900"
                                    : "border-slate-200 hover:border-slate-300 text-slate-800"
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
                      {!isRevealed ? (
                        <Button
                          onClick={() => reveal(i)}
                          disabled={!pick}
                          className="mt-3 h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Check answer
                        </Button>
                      ) : (
                        q.explanation && (
                          <p className="mt-3 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                            <span className="font-semibold text-slate-700">Why:</span> {q.explanation}
                          </p>
                        )
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
      </div>
    </div>
  );
}
