/**
 * AssignedSessionPlay — student player for a teacher-assigned learning session
 * bundle. Renders through the SHARED SessionFlow engine so it has the exact
 * same design/steps/flow as the curriculum learn, single, and live sessions.
 * The only assigned-specific bits are the data source (lesson_bundles payload)
 * and persistence (student_bundle_completion + spaced repetition).
 *
 * Persists one row per student+assignment:
 *   quiz_total/correct/score_pct/responses, attention_check_total/correct/responses,
 *   case_study_score/max/responses, + the spaced-repetition schedule.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { gradeLearnSession, gradeReview, addDays } from "@/lib/spacedRepetition";
import { quest } from "@/api/questClient";
import { supabase } from "@/components/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle, ArrowLeft } from "lucide-react";
import SessionFlow from "@/components/session/SessionFlow";
import { bundlePayloadToContent } from "@/lib/sessionContent";

export default function AssignedSessionPlay() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get("assignment_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!assignmentId) { setError("No assignment specified."); setLoading(false); return; }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        .eq("id", assignmentId).single();
      if (aErr) throw aErr;
      setAssignment(aRow);

      const { data: bRow, error: bErr } = await supabase
        .from("lesson_bundles")
        .select("id, title, source_type, source_url, payload, grade_level")
        .eq("id", aRow.bundle_id).single();
      if (bErr) throw bErr;
      setBundle(bRow);

      const { data: cRow } = await supabase
        .from("student_bundle_completion").select("*")
        .eq("student_id", me.id).eq("assignment_id", aRow.id).maybeSingle();
      if (cRow) setCompletion(cRow);
    } catch (err) {
      console.error("Failed to load assigned session:", err);
      setError(err?.message || "Could not load this session.");
    } finally {
      setLoading(false);
    }
  };

  const content = useMemo(
    () => bundlePayloadToContent(bundle?.payload, { badgeLabel: "Single Session", sourceUrl: bundle?.source_url }),
    [bundle]
  );

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

  const handleCaseStudySave = async (csPayload) => { caseResponseRef.current = csPayload; };

  const handleFinish = async (result) => {
    if (!user || !assignment || submitting) return;
    setSubmitting(true);
    try {
      const quizResponses = quizResponsesRef.current;
      const acResponses = acResponsesRef.current;
      const caseResp = caseResponseRef.current;

      const quizTotal = content.questions.length;
      const quizCorrect = result?.mcCorrect ?? quizResponses.filter((r) => r.is_correct).length;
      const quizPct = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : null;
      const acTotal = content.attentionChecks.length;
      const acCorrect = acResponses.filter((r) => r.is_correct).length;
      const csScore = caseResp ? caseResp.total_score : null;
      const csMax = caseResp ? 4 : null;

      // Standardized score from the shared engine (quiz + case study only).
      const sessionScore = result?.score ?? null;

      // Unified spaced repetition — first completion grades like a learn
      // session; later ones advance the ladder.
      const now = new Date();
      const priorCount = completion?.review_count ?? null;
      let nextReview, urgency, reviewCount;
      if (sessionScore === null) {
        reviewCount = priorCount ?? 0;
        nextReview = addDays(2, now);
        urgency = "Medium";
      } else {
        const graded = priorCount === null ? gradeLearnSession(sessionScore) : gradeReview(sessionScore, priorCount);
        reviewCount = priorCount === null ? 0 : graded.reviewCount;
        nextReview = graded.nextReviewDate || addDays(1, now);
        urgency = graded.urgency;
      }

      const row = {
        student_id: user.id,
        assignment_id: assignment.id,
        quiz_total: quizTotal || null,
        quiz_correct: quizTotal > 0 ? quizCorrect : null,
        quiz_score_pct: quizPct,
        quiz_responses: quizResponses.length ? quizResponses : null,
        attention_check_total: acTotal || null,
        attention_check_correct: acTotal > 0 ? acCorrect : null,
        attention_check_responses: acResponses.length ? acResponses : null,
        case_study_responses: caseResp ? [caseResp] : null,
        case_study_score: csScore,
        case_study_max: csMax,
        completed_at: now.toISOString(),
        next_review_date: nextReview.toISOString(),
        last_review_date: now.toISOString(),
        review_count: reviewCount,
        urgency_status: urgency,
      };

      const { error: upErr } = await supabase
        .from("student_bundle_completion")
        .upsert(row, { onConflict: "student_id,assignment_id" });
      if (upErr) throw upErr;
    } catch (err) {
      console.error("Failed to save completion:", err);
    } finally {
      setSubmitting(false);
      navigate(createPageUrl("LearningHub"));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error && !bundle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center shadow-md">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Can't open this session</h2>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <Button onClick={() => navigate(createPageUrl("LearningHub"))} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Learning Hub
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SessionFlow
      content={content}
      inquiryMode="inline"
      events={events}
      onCaseStudySave={handleCaseStudySave}
      onFinish={handleFinish}
      onExit={() => navigate(createPageUrl("LearningHub"))}
    />
  );
}
